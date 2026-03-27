/**
 * NormaWExpert ATH format parser
 *
 * ATH is an INI-like text format (CP1250 encoding) exported by NormaWExpert/Athenasoft.
 * One file contains both the cost estimate (like PDF Typ B) and material list (like PDF Typ A).
 *
 * Key sections:
 *   [KOSZTORYS ATHENASOFT] — totals: wk= brutto, wn= tab-separated [Kp, Zysk, VAT_amount]
 *   [STRONA TYT]           — metadata: nb= title, ab= address, ni= investor, nw= contractor, dt= date
 *   [NARZUTY NORMA N]      — surcharges; na=VAT identifies VAT section, wa= rate
 *   [ELEMENT 1/2]          — chapters: nu= number (e.g. "1", "2.1"), na= name, wa= netto total
 *   [POZYCJA]              — cost items: pd= KNR, na= name, jm= unit, ob= qty, cj= unit price
 *   [RMS ZEST N]           — resource summary; ty=M → material, na= name, id= code, il= qty, cw= price
 */

import type {
  ParsedMaterial,
  ParsedEstimate,
  ProjectMeta,
  ParsedCostChapter,
  ParsedCostItem,
} from "./pdf-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse Polish-formatted number from ATH: "2 100,00" or "2100,00" → 2100.00 */
function parseAthNum(s: string): number | null {
  if (!s) return null;
  // Take only the first tab-separated token
  const token = s.split("\t")[0].trim();
  const clean = token.replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/** First tab-separated token of a field value */
function firstToken(s: string): string {
  return (s ?? "").split("\t")[0].trim();
}

// ---------------------------------------------------------------------------
// Section parser
// ---------------------------------------------------------------------------

type Section = {
  /** Header name, e.g. "ELEMENT 1", "POZYCJA", "RMS ZEST 12" */
  name: string;
  /** Sequential index in file — used to associate POZYCJAs with their parent ELEMENT */
  index: number;
  fields: Record<string, string>;
};

function parseSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | null = null;
  let idx = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    const headerMatch = line.match(/^\[(.+)\]$/);
    if (headerMatch) {
      current = { name: headerMatch[1], index: idx++, fields: {} };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    const eqPos = line.indexOf("=");
    if (eqPos > 0) {
      const key = line.slice(0, eqPos).trim();
      const value = line.slice(eqPos + 1); // preserve tabs in value
      // If key already exists, keep first occurrence (some keys repeat with different data)
      if (!(key in current.fields)) {
        current.fields[key] = value;
      }
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseAth(buffer: Buffer): {
  estimate: ParsedEstimate;
  materials: ParsedMaterial[];
  totalRg: number | null;
} {
  // Decode CP1250 — supported by Node.js TextDecoder (WHATWG Encoding API)
  let text: string;
  try {
    text = new TextDecoder("windows-1250").decode(buffer);
  } catch {
    // Fallback: latin1 covers the basic byte range
    text = buffer.toString("latin1");
  }

  const sections = parseSections(text);

  // ── Meta ──────────────────────────────────────────────────────────────────
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

  const kosztorysSec = sections.find((s) => s.name === "KOSZTORYS ATHENASOFT");
  if (kosztorysSec) {
    meta.total_brutto = parseAthNum(kosztorysSec.fields["wk"] ?? "");
    // wn= is tab-separated: Kp_amount \t Zysk_amount \t VAT_amount
    const wnParts = (kosztorysSec.fields["wn"] ?? "").split("\t");
    if (wnParts.length >= 3) {
      meta.vat_amount = parseAthNum(wnParts[2]);
    }
    if (meta.total_brutto !== null && meta.vat_amount !== null) {
      meta.total_netto =
        Math.round((meta.total_brutto - meta.vat_amount) * 100) / 100;
    }
  }

  const stronaTytSec = sections.find((s) => s.name === "STRONA TYT");
  if (stronaTytSec) {
    meta.title = firstToken(stronaTytSec.fields["nb"] ?? "") || null;
    meta.address = firstToken(stronaTytSec.fields["ab"] ?? "") || null;
    meta.investor = firstToken(stronaTytSec.fields["ni"] ?? "") || null;
    meta.contractor_name = firstToken(stronaTytSec.fields["nw"] ?? "") || null;
    meta.date = firstToken(stronaTytSec.fields["dt"] ?? "") || null;
  }

  // VAT rate from [NARZUTY NORMA N] where na= starts with "VAT"
  for (const s of sections) {
    if (!s.name.startsWith("NARZUTY NORMA")) continue;
    if (firstToken(s.fields["na"] ?? "") === "VAT") {
      meta.vat_rate = parseAthNum(s.fields["wa"] ?? "");
      break;
    }
  }

  // ── Chapters ([ELEMENT 1] and [ELEMENT 2] sections) ──────────────────────
  const elementSections = sections.filter((s) => /^ELEMENT\s+[12]$/.test(s.name));

  // Sort by file order (index) so chapters appear in document order
  elementSections.sort((a, b) => a.index - b.index);

  const chapters: ParsedCostChapter[] = [];
  const chapterNumByIndex: Record<number, string> = {}; // sectionIndex → chapter nu

  for (let i = 0; i < elementSections.length; i++) {
    const el = elementSections[i];
    const nu = firstToken(el.fields["nu"] ?? "") || String(i + 1);
    const level = nu.includes(".") ? 2 : 1;
    chapters.push({
      number: nu,
      name: firstToken(el.fields["na"] ?? ""),
      level,
      order_index: i,
      total_netto: parseAthNum(el.fields["wa"] ?? ""),
    });
    chapterNumByIndex[el.index] = nu;
  }

  // ── Cost items ([POZYCJA] + [PRZEDMIAR] sections) ────────────────────────
  const costItems: ParsedCostItem[] = [];
  // Track position counter per chapter
  const posCounterByChapter: Record<string, number> = {};

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.name !== "POZYCJA") continue;

    // Find nearest preceding ELEMENT section
    let parentChapterNum = chapters[0]?.number ?? "1";
    for (let j = i - 1; j >= 0; j--) {
      if (/^ELEMENT\s+[12]$/.test(sections[j].name)) {
        parentChapterNum = chapterNumByIndex[sections[j].index] ?? parentChapterNum;
        break;
      }
    }

    // Position counter within chapter
    posCounterByChapter[parentChapterNum] =
      (posCounterByChapter[parentChapterNum] ?? 0) + 1;
    const lp = `${parentChapterNum}.${posCounterByChapter[parentChapterNum]}`;

    // KNR from pd= (tab-separated: catalog \t type \t knr \t ...)
    const pdParts = (s.fields["pd"] ?? "").split("\t");
    let knr: string | null = null;
    if (pdParts.length >= 3 && pdParts[1] && pdParts[2]) {
      knr = `${pdParts[1].trim()} ${pdParts[2].trim()}`.trim() || null;
    }

    const qty = parseAthNum(s.fields["ob"] ?? "");
    const unitPrice = parseAthNum(s.fields["cj"] ?? "");
    const totalValue =
      qty !== null && unitPrice !== null
        ? Math.round(qty * unitPrice * 100) / 100
        : null;

    // Measurement formula from immediately following [PRZEDMIAR] section
    let measurement: string | null = null;
    if (i + 1 < sections.length && sections[i + 1].name === "PRZEDMIAR") {
      const przedmiar = sections[i + 1];
      // wo= is tab-separated: result \t flag \t formula \t ... \t unit
      const woParts = (przedmiar.fields["wo"] ?? "").split("\t");
      const result = woParts[0]?.trim();
      const formula = woParts[2]?.trim();
      // Strip descriptive qualifiers from unit: "m2 ściany" → "m2", "m3 drew." → "m3"
      const unit = (firstToken(s.fields["jm"] ?? "").split(" ")[0]) || null;
      if (formula) {
        measurement = unit ? `${formula} = ${result} ${unit}` : `${formula} = ${result}`;
      } else if (result) {
        measurement = unit ? `${result} ${unit}` : result;
      }
    }

    costItems.push({
      lp,
      chapter_number: parentChapterNum,
      knr,
      name: firstToken(s.fields["na"] ?? ""),
      unit: (firstToken(s.fields["jm"] ?? "").split(" ")[0]) || null,
      qty,
      unit_price: unitPrice,
      total_value_netto: totalValue,
      measurement,
    });
  }

  const estimate: ParsedEstimate = { meta, chapters, items: costItems };

  // ── Materials from [RMS ZEST N] ty=M ─────────────────────────────────────
  // Build chapter lookup by nu value
  const chapterByNu: Record<string, ParsedCostChapter> = {};
  for (const ch of chapters) chapterByNu[ch.number] = ch;

  const materialMap = new Map<string, ParsedMaterial>();
  const materials: ParsedMaterial[] = [];
  let matLp = 1;

  // rmsIndex → material code — used to identify materials in per-position [RMS N] sections
  const rmsIndexToCode = new Map<number, string>();

  for (const s of sections) {
    if (!s.name.startsWith("RMS ZEST ")) continue;
    if (firstToken(s.fields["ty"] ?? "").toUpperCase() !== "M") continue;

    const code = (s.fields["id"] ?? "").split("\t")[0].trim();
    const name = firstToken(s.fields["na"] ?? "");
    if (!name || !code || code === "0000000") continue;

    const qty = parseAthNum(s.fields["il"] ?? "");
    const unitPrice = parseAthNum(s.fields["cw"] ?? "");
    const totalValue =
      qty !== null && unitPrice !== null
        ? Math.round(qty * unitPrice * 100) / 100
        : null;
    const unit = firstToken(s.fields["jm"] ?? "") || null;

    const rmsNum = parseInt(s.name.slice("RMS ZEST ".length).trim(), 10);
    if (!isNaN(rmsNum)) rmsIndexToCode.set(rmsNum, code);

    const existing = materialMap.get(code);
    if (existing) {
      existing.total_qty = Math.round(((existing.total_qty ?? 0) + (qty ?? 0)) * 10000) / 10000;
      existing.total_value = Math.round(((existing.total_value ?? 0) + (totalValue ?? 0)) * 100) / 100;
    } else {
      materialMap.set(code, {
        lp: matLp++,
        index_code: code,
        name,
        unit,
        total_qty: qty,
        unit_price: unitPrice,
        total_value: totalValue,
        depts: [],
      });
      materials.push(materialMap.get(code)!);
    }
  }

  // ── Per-position dept assignment from [RMS N] sections ───────────────────
  // Each [RMS N] section appears after an [ELEMENT] section (chapter context).
  // il= is the actual quantity used in that position; sum across positions
  // equals the global total in [RMS ZEST N].
  // This approach correctly handles materials that span multiple chapters and
  // sub-chapters (dotted nu like "2.1", "2.2").
  {
    // Accumulate qty per (code, chapterNu)
    const deptQty = new Map<string, Map<string, number>>(); // code → chapterNu → qty
    let curChapterNu: string | null = null;

    for (const s of sections) {
      if (/^ELEMENT\s+[12]$/.test(s.name)) {
        curChapterNu = firstToken(s.fields["nu"] ?? "") || null;
        continue;
      }
      const rmsMatch = s.name.match(/^RMS\s+(\d+)$/);
      if (!rmsMatch || curChapterNu === null) continue;
      const code = rmsIndexToCode.get(parseInt(rmsMatch[1], 10));
      if (!code) continue;
      const il = parseAthNum(s.fields["il"] ?? "");
      if (il === null || il === 0) continue;
      if (!deptQty.has(code)) deptQty.set(code, new Map());
      const m = deptQty.get(code)!;
      m.set(curChapterNu, Math.round(((m.get(curChapterNu) ?? 0) + il) * 10000) / 10000);
    }

    // Build dept entries
    for (const [code, chapterMap] of deptQty) {
      const mat = materialMap.get(code);
      if (!mat) continue;
      for (const [chNu, qty] of chapterMap) {
        const isDot = chNu.includes(".");
        const parentNum = isDot ? chNu.split(".")[0] : chNu;
        const parentCh = chapterByNu[parentNum];
        const subCh = isDot ? chapterByNu[chNu] : null;
        mat.depts.push({
          dept_number: parentNum,
          dept_name: parentCh?.name ?? parentNum,
          sub_dept_number: isDot ? chNu : null,
          sub_dept_name: isDot ? (subCh?.name ?? chNu) : null,
          unit: mat.unit,
          qty,
          unit_price: mat.unit_price,
          value: mat.unit_price !== null ? Math.round(qty * mat.unit_price * 100) / 100 : null,
        });
      }
    }
  }

  // ── Total roboczogodziny ([RMS ZEST N] with ty=R) ────────────────────────
  let totalRg: number | null = null;
  for (const s of sections) {
    if (!s.name.startsWith("RMS ZEST ")) continue;
    if (firstToken(s.fields["ty"] ?? "").toUpperCase() !== "R") continue;
    const qty = parseAthNum(s.fields["il"] ?? "");
    if (qty !== null) {
      totalRg = Math.round(((totalRg ?? 0) + qty) * 100) / 100;
    }
  }

  return { estimate, materials, totalRg };
}
