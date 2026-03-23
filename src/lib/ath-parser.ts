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

  // ── Cost items ([POZYCJA] sections) ──────────────────────────────────────
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

    costItems.push({
      lp,
      chapter_number: parentChapterNum,
      knr,
      name: firstToken(s.fields["na"] ?? ""),
      unit: firstToken(s.fields["jm"] ?? "") || null,
      qty,
      unit_price: unitPrice,
      total_value_netto: totalValue,
    });
  }

  const estimate: ParsedEstimate = { meta, chapters, items: costItems };

  // ── Materials ([RMS ZEST N] with ty=M) ───────────────────────────────────
  const materials: ParsedMaterial[] = [];
  let matLp = 1;

  for (const s of sections) {
    if (!s.name.startsWith("RMS ZEST ")) continue;
    if (firstToken(s.fields["ty"] ?? "") !== "M") continue;

    const name = firstToken(s.fields["na"] ?? "");
    // Skip placeholder entries (empty name or generic "materiały pomocnicze" with code 0000000)
    const code = firstToken(s.fields["id"] ?? "");
    if (!name || code === "0000000") continue;

    const qty = parseAthNum(s.fields["il"] ?? "");
    const unitPrice = parseAthNum(s.fields["cw"] ?? "");
    const totalValue =
      qty !== null && unitPrice !== null
        ? Math.round(qty * unitPrice * 100) / 100
        : null;

    materials.push({
      lp: matLp++,
      index_code: code,
      name,
      unit: firstToken(s.fields["jm"] ?? "") || null,
      total_qty: qty,
      unit_price: unitPrice,
      total_value: totalValue,
      depts: [], // ATH doesn't group materials by dept (chapter)
    });
  }

  return { estimate, materials };
}
