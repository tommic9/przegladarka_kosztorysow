import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parsePdf } from "@/lib/pdf-parser";
import { parseAth } from "@/lib/ath-parser";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/versions/[vid] data — returns data for a specific version
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id, 10);

  const url = new URL(req.url);
  const versionId = url.searchParams.get("v");

  if (session.role === "contractor") {
    const access = db
      .prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?")
      .get(projectId, session.userId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let version;
  if (versionId) {
    version = db
      .prepare("SELECT * FROM project_versions WHERE id = ? AND project_id = ?")
      .get(parseInt(versionId, 10), projectId);
  } else {
    version = db
      .prepare(
        "SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1"
      )
      .get(projectId);
  }

  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const v = version as { id: number };
  const materials = db.prepare("SELECT * FROM materials WHERE version_id = ? ORDER BY lp").all(v.id);
  const depts = db.prepare(
    `SELECT md.* FROM material_depts md JOIN materials m ON m.id = md.material_id WHERE m.version_id = ?`
  ).all(v.id);
  const chapters = db.prepare("SELECT * FROM cost_chapters WHERE version_id = ? ORDER BY order_index").all(v.id);
  const items = db.prepare("SELECT * FROM cost_items WHERE version_id = ? ORDER BY lp").all(v.id);

  return NextResponse.json({ version, materials, depts, chapters, items });
}

// POST /api/projects/[id]/versions — upload new version
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);

  try {
    const formData = await req.formData();
    const notes = (formData.get("notes") as string) || null;
    const estimateFile = formData.get("estimate") as File | null;
    const materialsFile = formData.get("materials") as File | null;
    const athFile = formData.get("ath") as File | null;

    // Get next version number
    const lastVersion = db
      .prepare("SELECT MAX(version_number) as max FROM project_versions WHERE project_id = ?")
      .get(projectId) as { max: number | null };
    const nextVersion = (lastVersion.max ?? 0) + 1;

    let totalNetto: number | null = null;
    let vatRate: number | null = null;
    let vatAmount: number | null = null;
    let totalBrutto: number | null = null;
    let estimateFileName: string | null = null;
    let materialsFileName: string | null = null;

    type CostChapter = { number: string; name: string; level: number; order_index: number; total_netto: number | null };
    type CostItem = { lp: string; chapter_number: string; knr: string | null; name: string; unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null; measurement: string | null };
    type Material = { lp: number; index_code: string; name: string; unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null; depts: { dept_number: string; dept_name: string; sub_dept_number: string | null; sub_dept_name: string | null; unit: string | null; qty: number | null; unit_price: number | null; value: number | null }[] };

    let costChapters: CostChapter[] = [];
    let costItems: CostItem[] = [];
    let materials: Material[] = [];

    if (athFile) {
      // ATH contains both estimate and materials
      estimateFileName = athFile.name;
      materialsFileName = athFile.name;
      const buf = Buffer.from(await athFile.arrayBuffer());
      const { estimate, materials: athMaterials } = parseAth(buf);
      totalNetto = estimate.meta.total_netto;
      vatRate = estimate.meta.vat_rate;
      vatAmount = estimate.meta.vat_amount;
      totalBrutto = estimate.meta.total_brutto;
      if (estimate.meta.title || estimate.meta.investor || estimate.meta.address) {
        db.prepare(
          `UPDATE projects SET title = COALESCE(?, title), address = COALESCE(?, address),
           investor = COALESCE(?, investor), contractor_name = COALESCE(?, contractor_name)
           WHERE id = ?`
        ).run(estimate.meta.title, estimate.meta.address, estimate.meta.investor, estimate.meta.contractor_name, projectId);
      }
      costChapters = estimate.chapters;
      costItems = estimate.items;
      materials = athMaterials;
    } else {
      if (estimateFile) {
        estimateFileName = estimateFile.name;
        const buf = Buffer.from(await estimateFile.arrayBuffer());
        const result = await parsePdf(buf);
        if (result.type === "B") {
          const { meta: m, chapters, items } = result.estimate;
          totalNetto = m.total_netto;
          vatRate = m.vat_rate;
          vatAmount = m.vat_amount;
          totalBrutto = m.total_brutto;
          if (m.title || m.investor || m.address) {
            db.prepare(
              `UPDATE projects SET title = COALESCE(?, title), address = COALESCE(?, address),
               investor = COALESCE(?, investor), contractor_name = COALESCE(?, contractor_name)
               WHERE id = ?`
            ).run(m.title, m.address, m.investor, m.contractor_name, projectId);
          }
          costChapters = chapters;
          costItems = items;
        }
      }

      if (materialsFile) {
        materialsFileName = materialsFile.name;
        const buf = Buffer.from(await materialsFile.arrayBuffer());
        const result = await parsePdf(buf);
        if (result.type === "A") {
          materials = result.materials;
        }
      }
    }

    const insertVersion = db.prepare(
      `INSERT INTO project_versions (project_id, version_number, notes, total_netto, vat_rate, vat_amount, total_brutto, materials_file_name, estimate_file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMaterial = db.prepare(
      `INSERT INTO materials (version_id, lp, index_code, name, unit, total_qty, unit_price, total_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertDept = db.prepare(
      `INSERT INTO material_depts (material_id, dept_number, dept_name, sub_dept_number, sub_dept_name, qty, value) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertChapter = db.prepare(
      `INSERT INTO cost_chapters (version_id, number, name, order_index, total_netto) VALUES (?, ?, ?, ?, ?)`
    );
    const insertItem = db.prepare(
      `INSERT INTO cost_items (version_id, chapter_id, lp, knr, name, unit, qty, unit_price, total_value_netto, measurement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const run = db.transaction(() => {
      const { lastInsertRowid: versionId } = insertVersion.run(
        projectId, nextVersion, notes, totalNetto, vatRate, vatAmount, totalBrutto,
        materialsFileName, estimateFileName
      );

      const chapterIdMap: Record<string, number> = {};
      for (const ch of costChapters) {
        const { lastInsertRowid: chId } = insertChapter.run(
          versionId, ch.number, ch.name, ch.order_index, ch.total_netto
        );
        chapterIdMap[ch.number] = Number(chId);
      }

      for (const item of costItems) {
        const chapterId = chapterIdMap[item.chapter_number] ?? null;
        insertItem.run(versionId, chapterId, item.lp, item.knr, item.name,
          item.unit, item.qty, item.unit_price, item.total_value_netto,
          item.measurement ?? null);
      }

      for (const mat of materials) {
        const { lastInsertRowid: matId } = insertMaterial.run(
          versionId, mat.lp, mat.index_code, mat.name,
          mat.unit, mat.total_qty, mat.unit_price, mat.total_value
        );
        for (const dept of mat.depts) {
          insertDept.run(matId, dept.dept_number, dept.dept_name,
            dept.sub_dept_number, dept.sub_dept_name, dept.qty, dept.value);
        }
      }

      return Number(versionId);
    });

    const versionId = run();
    return NextResponse.json({ versionId, versionNumber: nextVersion }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects/[id]/versions error:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
