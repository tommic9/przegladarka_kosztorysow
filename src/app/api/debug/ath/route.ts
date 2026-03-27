import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

// POST /api/debug/ath — admin only, returns section structure of uploaded ATH file
// Does NOT save anything to DB. Used to diagnose ATH parser issues.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("windows-1250").decode(buf);
  } catch {
    text = buf.toString("latin1");
  }

  // Parse sections
  const lines = text.split(/\r?\n/);
  type SectionInfo = {
    name: string;
    fields: Record<string, string>;
    lineNumber: number;
  };

  const sections: SectionInfo[] = [];
  let current: SectionInfo | null = null;
  let lineNum = 0;

  for (const raw of lines) {
    lineNum++;
    const line = raw.trimEnd();
    if (!line) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      current = { name: m[1], fields: {}, lineNumber: lineNum };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1);
      if (!(key in current.fields)) current.fields[key] = val;
    }
  }

  // Count section names
  const nameCounts: Record<string, number> = {};
  for (const s of sections) {
    const base = s.name.replace(/\s+\d+$/, " N"); // normalize e.g. "RMS ZEST 12" → "RMS ZEST N"
    nameCounts[base] = (nameCounts[base] ?? 0) + 1;
  }

  // Show first 5 occurrences of each RMS-type section with key fields
  const rmsSamples: Record<string, { name: string; fields: Record<string, string>; line: number }[]> = {};
  for (const s of sections) {
    if (!s.name.startsWith("RMS")) continue;
    const base = s.name.replace(/\s+\d+$/, " N");
    if (!rmsSamples[base]) rmsSamples[base] = [];
    if (rmsSamples[base].length < 5) {
      // Only show relevant fields
      const relevantFields: Record<string, string> = {};
      for (const k of ["ty", "id", "na", "il", "jm", "cw", "ca"]) {
        if (s.fields[k] !== undefined) relevantFields[k] = s.fields[k].slice(0, 80);
      }
      rmsSamples[base].push({ name: s.name, fields: relevantFields, line: s.lineNumber });
    }
  }

  // Show ELEMENT sections with their fields
  const elementSamples = sections
    .filter((s) => s.name.startsWith("ELEMENT"))
    .slice(0, 20)
    .map((s) => ({
      name: s.name,
      line: s.lineNumber,
      nu: s.fields["nu"],
      na: s.fields["na"],
      wa: s.fields["wa"],
    }));

  // Total counts
  const totalLines = lineNum;
  const totalSections = sections.length;

  return NextResponse.json({
    totalLines,
    totalSections,
    sectionCounts: Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40),
    rmsSamples,
    elementSamples,
    // Order of first 80 section names (to see file structure)
    sectionOrder: sections.slice(0, 80).map((s) => ({
      name: s.name,
      line: s.lineNumber,
      ty: s.fields["ty"],
    })),
  });
}
