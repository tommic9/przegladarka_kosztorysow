/**
 * NormaWExpert PDF parser
 *
 * Typ A — Zestawienie materiałów: sekcja "Szczegółowe zestawienie materiałów w działach"
 * Typ B — Kosztorys ofertowy: metadane na stronie tytułowej + tabela pozycji
 */

// pdf-parse v2 exports a named PDFParse class
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Parse Polish-formatted number: "2 100,00" → 2100.00, "1 253,7000" → 1253.7 */
function parseNum(s: string): number | null {
  if (!s) return null;
  const clean = s.trim().replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/**
 * Extract all Polish-formatted numbers from a text fragment.
 * Handles thousands separator (space): "2 100,00" "10 541"
 */
function extractNums(text: string): number[] {
  // Match: 1-3 digits, optionally followed by (space + 3 digits)*, optionally decimal
  const re = /\d{1,3}(?:\s\d{3})*(?:,\d+)?/g;
  return (text.match(re) ?? [])
    .map((m) => parseNum(m))
    .filter((n): n is number => n !== null);
}

const FOOTER_PATTERNS = [
  /^Norma EXPERT/,
  /^-\s*\d+\s*-$/,
  /^--\s*\d+\s*of\s*\d+\s*--$/,
  /^Lp\.\s+Indeks\s+Nazwa/,
  /^Lp\.\s+Podstawa\s+Opis/,
  /^Kosztorys uproszczony$/,
  /^Szczegółowe zestawienie materiałów w działach$/,
];

function isFooter(line: string): boolean {
  return FOOTER_PATTERNS.some((re) => re.test(line.trim()));
}

// Known units (ordered longer first to avoid partial matches)
const UNITS = [
  "m2",
  "m3",
  "dm3",
  "kg",
  "szt.",
  "szt",
  "mb",
  "kpl",
  "zł",
  "t",
  "m",
  "ar",
  "l",
];

function startsWithUnit(text: string): string | null {
  const t = text.trim();
  for (const u of UNITS) {
    if (t.startsWith(u + " ") || t === u) return u;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-detect PDF type
// ---------------------------------------------------------------------------

export type PdfType = "A" | "B" | "unknown";

export function detectPdfType(text: string): PdfType {
  if (/KOSZTORYS OFERTOWY/.test(text)) return "B";
  if (/Szczegółowe zestawienie materiałów w działach/.test(text)) return "A";
  if (/Zestawienie materiałów/.test(text)) return "A";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Shared: extract raw text from PDF buffer
// ---------------------------------------------------------------------------

export async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  return result.text as string;
}

// ---------------------------------------------------------------------------
// Typ A — parser materiałów
// ---------------------------------------------------------------------------

export type ParsedDept = {
  dept_number: string;
  dept_name: string;
  sub_dept_number: string | null;
  sub_dept_name: string | null;
  unit: string | null;
  qty: number | null;
  unit_price: number | null;
  value: number | null;
};

export type ParsedMaterial = {
  lp: number;
  index_code: string;
  name: string;
  unit: string | null;
  total_qty: number | null;
  unit_price: number | null;
  total_value: number | null;
  depts: ParsedDept[];
};

/**
 * Parse section data suffix: "kg 18,5301 10,50 195"  →  {unit, qty, unit_price, value}
 * Handles split numbers across lines (joined with space before calling).
 */
function parseSectionData(
  unit: string,
  numbersText: string
): { qty: number | null; unit_price: number | null; value: number | null } {
  const nums = extractNums(numbersText);
  if (nums.length === 0) return { qty: null, unit_price: null, value: null };
  if (nums.length === 1) return { qty: null, unit_price: null, value: nums[0] };
  if (nums.length === 2) return { qty: nums[0], unit_price: null, value: nums[1] };
  // 3+: qty, unit_price, value (Obmiar/Norma columns usually equal Ilość)
  return { qty: nums[0], unit_price: nums[nums.length - 2], value: nums[nums.length - 1] };
}

/**
 * Parse section line suffix.
 * Input: text after section number+dot+name (everything on same line + continued lines joined)
 * Returns { unit, qty, unit_price, value }
 */
function parseSuffix(suffix: string) {
  const trimmed = suffix.trim();
  // Find unit token
  for (const u of UNITS) {
    const idx = trimmed.indexOf(u);
    if (idx !== -1) {
      const after = trimmed.slice(idx + u.length);
      return { unit: u.replace(".", ""), ...parseSectionData(u, after) };
    }
  }
  return { unit: null, qty: null, unit_price: null, value: null };
}

/**
 * Determine if a line starts a new material entry.
 * Pattern: digits LP, SPACE, then index code (≥4 chars like "3950099", "k050072").
 * Requiring ≥4 chars prevents unit abbreviations (e.g. "mm", "m2") from matching.
 */
function isMaterialStart(line: string): RegExpMatchArray | null {
  return line.match(/^(\d+)\s+([A-Za-z0-9_]{4,})\s+(.*)$/);
}

/**
 * Determine if a line starts a section/dept line.
 * Pattern: starts with digit(s), then dot, optionally more digit(s)+dot.
 */
function isSectionStart(line: string): RegExpMatchArray | null {
  return line.match(/^(\d+(?:\.\d+)?)\.\s+(.*)$/);
}

export function parseMaterials(text: string): ParsedMaterial[] {
  // Find marker and take everything after it
  const markerIdx = text.indexOf("Szczegółowe zestawienie materiałów w działach");
  const workText = markerIdx >= 0 ? text.slice(markerIdx) : text;

  const allLines = workText.split("\n");
  const lines = allLines.map((l) => l.trim()).filter((l) => !isFooter(l));

  const materials: ParsedMaterial[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    const matMatch = isMaterialStart(line);
    if (!matMatch) { i++; continue; }

    const lp = parseInt(matMatch[1], 10);
    const index_code = matMatch[2];
    const nameParts: string[] = [matMatch[3]];

    i++;

    // Collect name continuation lines (before any section line or RAZEM)
    while (i < lines.length) {
      const next = lines[i];
      if (!next) { i++; continue; }
      if (isSectionStart(next) || /^RAZEM/.test(next) || isMaterialStart(next)) break;
      // If line starts with a known unit, it could be section data without a section header
      // (unlikely in Typ A but guard anyway)
      if (startsWithUnit(next)) break;
      nameParts.push(next);
      i++;
    }

    const name = nameParts.join(" ").trim();
    const depts: ParsedDept[] = [];
    let totalUnit: string | null = null;
    let totalQty: number | null = null;
    let totalUnitPrice: number | null = null;
    let totalValue: number | null = null;

    // Collect section lines and RAZEM
    while (i < lines.length) {
      const sLine = lines[i];
      if (!sLine) { i++; continue; }

      if (/^RAZEM/.test(sLine)) {
        // Parse RAZEM line: "RAZEM kg 32,5496 10,50 342"
        const razem = sLine.replace(/^RAZEM\s*/, "");
        const parsed = parseSuffix(razem);
        totalUnit = parsed.unit;
        totalQty = parsed.qty;
        totalUnitPrice = parsed.unit_price;
        totalValue = parsed.value;
        i++;
        break;
      }

      if (isMaterialStart(sLine)) break;

      const secMatch = isSectionStart(sLine);
      if (secMatch) {
        const secNumRaw = secMatch[1]; // e.g. "4" or "4.2"
        let secRest = secMatch[2]; // e.g. "Dach szt. 1" or "Roboty betonowe m3 0,0563 367,50 21"
        i++;

        // Collect continuation lines for this section (name wrap and/or split numbers)
        const continuationLines: string[] = [];
        while (i < lines.length) {
          const c = lines[i];
          if (!c) { i++; continue; }
          if (isSectionStart(c) || /^RAZEM/.test(c) || isMaterialStart(c)) break;
          continuationLines.push(c);
          i++;
        }

        const fullSec = [secRest, ...continuationLines].join(" ").trim();

        // Extract unit and numbers from the full text
        const parsed = parseSuffix(fullSec);

        // Determine dept hierarchy
        const isDot = secNumRaw.includes(".");
        let dept_number: string;
        let dept_name: string;
        let sub_dept_number: string | null = null;
        let sub_dept_name: string | null = null;

        if (isDot) {
          // Sub-dept: e.g. "4.2" → parent "4", sub "4.2"
          const parts = secNumRaw.split(".");
          dept_number = parts[0];
          sub_dept_number = secNumRaw;
          // Dept name is extracted from the section text before unit
          const nameEndIdx = parsed.unit
            ? fullSec.indexOf(parsed.unit)
            : fullSec.length;
          const rawName = fullSec.slice(0, nameEndIdx).trim();
          dept_name = ""; // will be filled by parent lookup or left empty
          sub_dept_name = rawName || secNumRaw;
        } else {
          dept_number = secNumRaw;
          const nameEndIdx = parsed.unit
            ? fullSec.indexOf(parsed.unit)
            : fullSec.length;
          dept_name = fullSec.slice(0, nameEndIdx).trim() || secNumRaw;
          sub_dept_number = null;
          sub_dept_name = null;
        }

        depts.push({
          dept_number,
          dept_name,
          sub_dept_number,
          sub_dept_name,
          unit: parsed.unit,
          qty: parsed.qty,
          unit_price: parsed.unit_price,
          value: parsed.value,
        });
        continue;
      }

      // Unknown line in context of sections — skip
      i++;
    }

    // If no RAZEM found, derive totals from depts (top-level only)
    if (totalValue === null && depts.length > 0) {
      const topLevel = depts.filter((d) => !d.sub_dept_number);
      if (topLevel.length === 1) {
        totalUnit = topLevel[0].unit;
        totalQty = topLevel[0].qty;
        totalUnitPrice = topLevel[0].unit_price;
        totalValue = topLevel[0].value;
      }
    }

    // Resolve dept_name for sub-depts using parent dept
    const deptNames: Record<string, string> = {};
    depts.forEach((d) => {
      if (!d.sub_dept_number) deptNames[d.dept_number] = d.dept_name;
    });
    depts.forEach((d) => {
      if (d.sub_dept_number && !d.dept_name && deptNames[d.dept_number]) {
        d.dept_name = deptNames[d.dept_number];
      }
    });

    materials.push({
      lp,
      index_code,
      name,
      unit: totalUnit,
      total_qty: totalQty,
      unit_price: totalUnitPrice,
      total_value: totalValue,
      depts,
    });
  }

  return materials;
}

// ---------------------------------------------------------------------------
// Typ B — parser kosztorysu ofertowego
// ---------------------------------------------------------------------------

export type ProjectMeta = {
  title: string | null;
  address: string | null;
  investor: string | null;
  contractor_name: string | null;
  total_netto: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  total_brutto: number | null;
  date: string | null;
};

export type ParsedCostChapter = {
  number: string;
  name: string;
  level: number; // 1 = chapter, 2 = sub-chapter
  order_index: number;
  total_netto: number | null;
};

export type ParsedCostItem = {
  lp: string; // "1.1.1"
  chapter_number: string; // "1.1"
  knr: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unit_price: number | null;
  total_value_netto: number | null;
  measurement: string | null;
};

export type ParsedEstimate = {
  meta: ProjectMeta;
  chapters: ParsedCostChapter[];
  items: ParsedCostItem[];
};

function extractMeta(lines: string[]): ProjectMeta {
  const meta: ProjectMeta = {
    title: null,
    address: null,
    investor: null,
    contractor_name: null,
    total_netto: null,
    vat_rate: null,
    vat_amount: null,
    total_brutto: null,
    date: null,
  };

  // Collect all text up to "Kosztorys uproszczony"
  const tableStart = lines.findIndex((l) => /^Kosztorys uproszczony/.test(l));
  const headerLines = tableStart >= 0 ? lines.slice(0, tableStart) : lines;
  const full = headerLines.join("\n");

  const extract = (pattern: RegExp, group = 1): string | null => {
    const m = full.match(pattern);
    return m ? m[group].trim() : null;
  };

  // Multi-line values: collect label + continuation until next label or empty
  function extractMultiline(label: string): string | null {
    const labelRe = new RegExp(label + ":\\s*(.*)");
    let found = false;
    const parts: string[] = [];
    for (const l of headerLines) {
      if (!found) {
        const m = l.match(labelRe);
        if (m) {
          found = true;
          if (m[1].trim()) parts.push(m[1].trim());
        }
      } else {
        // Stop on next known label or blank or NormaEXPERT
        if (/^(WYKONAWCA|ADRES|NIP|NAZWA|DATA|SŁOWNIE|WARTOŚĆ|PODATEK|OGÓŁEM|Norma EXPERT)/.test(l.trim())) break;
        if (!l.trim()) break;
        parts.push(l.trim());
      }
    }
    return parts.length > 0 ? parts.join(" ") : null;
  }

  meta.title = extractMultiline("NAZWA INWESTYCJI");
  meta.address = extractMultiline("ADRES INWESTYCJI");
  meta.investor = extractMultiline("NAZWA INWESTORA");
  meta.contractor_name = extractMultiline("WYKONAWCA");
  meta.date = extract(/DATA OPRACOWANIA:\s*(.+)/);

  // Values
  const nettoMatch = full.match(/WARTOŚĆ KOSZTORYSOWA ROBÓT BEZ PODATKU VAT:\s*([\d\s,]+)\s*zł/);
  if (nettoMatch) meta.total_netto = parseNum(nettoMatch[1]);

  const vatMatch = full.match(/PODATEK VAT:\s*\((\d+)%\)\s*([\d\s,]+)\s*zł/);
  if (vatMatch) {
    meta.vat_rate = parseFloat(vatMatch[1]);
    meta.vat_amount = parseNum(vatMatch[2]);
  }

  const bruttoMatch = full.match(/OGÓŁEM WARTOŚĆ KOSZTORYSOWA ROBÓT:\s*([\d\s,]+)\s*zł/);
  if (bruttoMatch) meta.total_brutto = parseNum(bruttoMatch[1]);

  return meta;
}

/**
 * Match hierarchical lp — no leading zeros.
 * Valid: "1", "1.1", "1.1.1", "2.3.4"
 * Invalid: "01", "01 0115-03" (KNR continuations)
 */
const LP_RE = /^([1-9]\d*(?:\.\d+)*)\s+(.+)$/;

function lpLevel(lp: string): number {
  return lp.split(".").length;
}

/** Chapters are level 1 or 2; items are level 3+ */
function isChapterLine(lp: string): boolean {
  return lpLevel(lp) <= 2;
}

/** KNR code start patterns */
const KNR_START_RE = /^(KNR|KNNR|NNRNKB|KNR-W|KNNR-W|KSNR|AT-)/i;

/** KNR code continuation: short line of only digits, dashes, spaces */
function isKnrContinuation(line: string): boolean {
  return /^[\d\-\s]+$/.test(line.trim()) && line.trim().length < 25;
}

/** Additional unit-like abbreviations that may appear as "rest" after a stray LP number */
const UNIT_ABBREVS = new Set([
  ...UNITS.map((u) => u.toLowerCase().replace(".", "")),
  "mm", "cm", "km", "ha", "db",
]);

/**
 * Returns true when the "rest" part of an LP_RE match looks like a
 * continuation line (KNR sub-code or lone unit abbreviation) rather than
 * a real chapter or cost-item LP.
 * Examples: "0203-04" (KNR sub-code), "mm" (pipe-size suffix like "150 mm")
 */
function looksLikeContinuation(rest: string): boolean {
  const r = rest.trim().toLowerCase().replace(".", "");
  if (UNIT_ABBREVS.has(r)) return true;
  if (isKnrContinuation(rest)) return true;
  return false;
}

/**
 * Parse a cost item's collected lines into KNR, description, and numeric data.
 *
 * Handles three unit-placement patterns found in NormaWExpert PDFs:
 *   (a) Unit on its own line:  [..., "m3 7,20 375,70 2 705,04"]
 *   (b) Unit + text split:     [..., "m2", "rzut", "u", "3,99 891,10 3 555,49"]
 *   (c) Unit inline:           [..., "description budowa m2 7,88 62,50 492,50"]
 */
function parseItemCollected(collected: string[]): {
  knr: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unit_price: number | null;
  total_value_netto: number | null;
} {
  // ── 1. Locate the unit line by scanning backwards ──────────────────────────
  let unitIdx = -1;
  let inlineUnitOffset = -1; // >-1 when unit is embedded mid-line (case c)

  for (let j = collected.length - 1; j >= 0; j--) {
    const t = collected[j].trim();

    // Case (a): line starts with a known unit
    if (startsWithUnit(t)) {
      unitIdx = j;
      break;
    }

    // Pure-number continuation (e.g. wrapped value) — keep scanning backwards
    if (/^[\d\s,]+$/.test(t) && t.length > 0) continue;

    // Case (b): short single-word fragment (e.g. "u", "rzutu") — skip
    if (t.length <= 15 && /^\S+$/.test(t)) continue;

    // Case (c): unit embedded mid-line — try to split here
    let found = false;
    for (const u of UNITS) {
      const esc = u.replace(".", "\\.");
      const m = new RegExp("(?:^|\\s)" + esc + "(?=\\s+[\\d,])").exec(t);
      if (m) {
        unitIdx = j;
        inlineUnitOffset = m.index + (m[0].startsWith(" ") ? 1 : 0);
        found = true;
        break;
      }
    }
    // Stop regardless (whether embedded unit was found or not)
    break;
  }

  // ── 2. Split collected into header and data ────────────────────────────────
  let headerLines: string[];
  let dataText: string;

  if (unitIdx < 0) {
    headerLines = collected;
    dataText = "";
  } else if (inlineUnitOffset >= 0) {
    const line = collected[unitIdx].trim();
    const headerPart = line.slice(0, inlineUnitOffset).trim();
    headerLines = [
      ...collected.slice(0, unitIdx),
      ...(headerPart ? [headerPart] : []),
    ];
    dataText = line.slice(inlineUnitOffset);
  } else {
    headerLines = collected.slice(0, unitIdx);
    dataText = collected.slice(unitIdx).join(" ");
  }

  // ── 3. Extract KNR from start of header ────────────────────────────────────
  let knrEnd = 0;
  if (headerLines.length > 0 && KNR_START_RE.test(headerLines[0])) {
    knrEnd = 1;
    for (let j = 1; j < Math.min(headerLines.length, 4); j++) {
      if (isKnrContinuation(headerLines[j])) knrEnd = j + 1;
      else break;
    }
  }

  const knr = knrEnd > 0
    ? headerLines.slice(0, knrEnd).join(" ").replace(/\s+/g, " ").trim()
    : null;
  const name = headerLines.slice(knrEnd).join(" ").replace(/\s+/g, " ").trim();

  // ── 4. Parse unit + numbers from dataText ─────────────────────────────────
  let unit: string | null = null;
  let qty: number | null = null;
  let unitPrice: number | null = null;
  let totalValue: number | null = null;

  if (dataText) {
    const u = startsWithUnit(dataText.trim());
    if (u) {
      unit = u.replace(".", "");
      const afterUnit = dataText.trim().slice(u.length);
      // Strip any non-numeric word(s) immediately after the unit (e.g. "rzutu")
      const numText = afterUnit.replace(/^[\s]*[a-zA-Z\u00C0-\u024F]+[\s]*/g, " ");
      const nums = extractNums(numText);
      if (nums.length === 1) { totalValue = nums[0]; }
      else if (nums.length === 2) { qty = nums[0]; totalValue = nums[1]; }
      else if (nums.length >= 3) {
        qty = nums[0];
        unitPrice = nums[nums.length - 2];
        totalValue = nums[nums.length - 1];
      }
    }
  }

  return { knr: knr || null, name, unit, qty, unit_price: unitPrice, total_value_netto: totalValue };
}

export function parseEstimate(text: string): ParsedEstimate {
  const allLines = text.split("\n");
  const lines = allLines.map((l) => l.trim());

  const meta = extractMeta(lines);

  // Find table start
  const tableStartIdx = lines.findIndex((l) => /^Kosztorys uproszczony/.test(l));
  if (tableStartIdx < 0) {
    return { meta, chapters: [], items: [] };
  }

  const chapters: ParsedCostChapter[] = [];
  const items: ParsedCostItem[] = [];

  const tableLines = lines
    .slice(tableStartIdx)
    .filter((l) => !isFooter(l) && l !== "");

  let orderIdx = 0;
  let i = 0;

  while (i < tableLines.length) {
    const line = tableLines[i];

    const lpMatch = line.match(LP_RE);
    if (!lpMatch) {
      // "Razem dział:" lines — update last chapter total
      const razem = line.match(/^Razem dział:\s+.+?\s+([\d\s,]+)$/);
      if (razem) {
        const val = parseNum(razem[1]);
        const ch = [...chapters].reverse().find((c) => c.total_netto === null);
        if (ch && val !== null) ch.total_netto = val;
      }
      const nettoLine = line.match(/^Kosztorys netto\s+([\d\s,]+)$/);
      if (nettoLine && meta.total_netto === null) {
        meta.total_netto = parseNum(nettoLine[1]);
      }
      i++;
      continue;
    }

    const lp = lpMatch[1];
    const rest = lpMatch[2];
    const level = lpLevel(lp);

    if (isChapterLine(lp)) {
      // Collect chapter name (may wrap across lines)
      const nameParts: string[] = [rest];
      i++;
      while (i < tableLines.length) {
        const n = tableLines[i];
        if (n.match(LP_RE) || /^Razem dział:/.test(n)) break;
        nameParts.push(n);
        i++;
      }
      chapters.push({
        number: lp,
        name: nameParts.join(" ").trim(),
        level,
        order_index: orderIdx++,
        total_netto: null,
      });
    } else {
      // Cost item (3+ levels) — collect all lines until next real LP or Razem
      const collected: string[] = [rest];
      i++;
      while (i < tableLines.length) {
        const n = tableLines[i];
        if (/^Razem dział:/.test(n) || /^Kosztorys netto/.test(n)) break;
        // Break on LP_RE match unless it looks like a KNR continuation or unit suffix
        const lpCont = n.match(LP_RE);
        if (lpCont && !looksLikeContinuation(lpCont[2])) break;
        collected.push(n);
        i++;
      }

      const chapterNum = lp.split(".").slice(0, -1).join(".");
      const parsed = parseItemCollected(collected);

      items.push({
        lp,
        chapter_number: chapterNum,
        knr: parsed.knr,
        name: parsed.name || rest,
        unit: parsed.unit,
        qty: parsed.qty,
        unit_price: parsed.unit_price,
        total_value_netto: parsed.total_value_netto,
        measurement: null,
      });
    }
  }

  return { meta, chapters, items };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type ParseResult =
  | { type: "A"; materials: ParsedMaterial[] }
  | { type: "B"; estimate: ParsedEstimate }
  | { type: "ATH"; estimate: ParsedEstimate; materials: ParsedMaterial[] }
  | { type: "unknown" };

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const text = await extractText(buffer);
  const type = detectPdfType(text);

  if (type === "A") {
    const materials = parseMaterials(text);
    return { type: "A", materials };
  }

  if (type === "B") {
    const estimate = parseEstimate(text);
    return { type: "B", estimate };
  }

  return { type: "unknown" };
}
