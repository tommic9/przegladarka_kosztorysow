import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parsePdf } from "@/lib/pdf-parser";
import { parseAth } from "@/lib/ath-parser";

// GET /api/projects — list projects (admin: all, contractor: assigned)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rows;
  if (session.role === "admin") {
    rows = db
      .prepare(
        `SELECT p.*, pv.id as version_id, pv.version_number, pv.uploaded_at, pv.total_brutto,
                pv.total_netto, pv.vat_rate,
                (SELECT COUNT(*) FROM materials WHERE version_id = pv.id) as material_count
         FROM projects p
         LEFT JOIN project_versions pv ON pv.project_id = p.id
           AND pv.version_number = (SELECT MAX(version_number) FROM project_versions WHERE project_id = p.id)
         ORDER BY p.created_at DESC`
      )
      .all();
  } else {
    rows = db
      .prepare(
        `SELECT p.*, pv.id as version_id, pv.version_number, pv.uploaded_at, pv.total_brutto,
                pv.total_netto, pv.vat_rate,
                (SELECT COUNT(*) FROM materials WHERE version_id = pv.id) as material_count
         FROM projects p
         JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = ?
         LEFT JOIN project_versions pv ON pv.project_id = p.id
           AND pv.version_number = (SELECT MAX(version_number) FROM project_versions WHERE project_id = p.id)
         ORDER BY p.created_at DESC`
      )
      .all(session.userId);
  }

  return NextResponse.json({ projects: rows });
}

// POST /api/projects — create project with uploaded PDFs
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const notes = (formData.get("notes") as string) || null;
    const estimateFile = formData.get("estimate") as File | null;
    const materialsFile = formData.get("materials") as File | null;
    const athFile = formData.get("ath") as File | null;

    if (!title) {
      return NextResponse.json({ error: "Tytuł projektu jest wymagany" }, { status: 400 });
    }

    // Parse files
    let meta = {
      title,
      client_name: null as string | null,
      address: null as string | null,
      investor: null as string | null,
      contractor_name: null as string | null,
    };
    let totalNetto: number | null = null;
    let vatRate: number | null = null;
    let vatAmount: number | null = null;
    let totalBrutto: number | null = null;
    let estimateFileName: string | null = null;
    let materialsFileName: string | null = null;

    type CostChapterData = { number: string; name: string; level: number; order_index: number; total_netto: number | null };
    type CostItemData = { lp: string; chapter_number: string; knr: string | null; name: string; unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null };
    type MaterialData = { lp: number; index_code: string; name: string; unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null; depts: { dept_number: string; dept_name: string; sub_dept_number: string | null; sub_dept_name: string | null; unit: string | null; qty: number | null; unit_price: number | null; value: number | null }[] };

    let costChapters: CostChapterData[] = [];
    let costItems: CostItemData[] = [];
    let materials: MaterialData[] = [];

    if (athFile) {
      // ATH file contains both estimate and materials
      estimateFileName = athFile.name;
      materialsFileName = athFile.name;
      const buf = Buffer.from(await athFile.arrayBuffer());
      const { estimate, materials: athMaterials } = parseAth(buf);
      meta.title = estimate.meta.title || title;
      meta.address = estimate.meta.address;
      meta.investor = estimate.meta.investor;
      meta.contractor_name = estimate.meta.contractor_name;
      totalNetto = estimate.meta.total_netto;
      vatRate = estimate.meta.vat_rate;
      vatAmount = estimate.meta.vat_amount;
      totalBrutto = estimate.meta.total_brutto;
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
          meta.title = m.title || title;
          meta.address = m.address;
          meta.investor = m.investor;
          meta.contractor_name = m.contractor_name;
          totalNetto = m.total_netto;
          vatRate = m.vat_rate;
          vatAmount = m.vat_amount;
          totalBrutto = m.total_brutto;
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

    // Save to DB in a transaction
    const insertProject = db.prepare(
      `INSERT INTO projects (title, client_name, address, investor, contractor_name)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertVersion = db.prepare(
      `INSERT INTO project_versions (project_id, version_number, notes, total_netto, vat_rate, vat_amount, total_brutto, materials_file_name, estimate_file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMaterial = db.prepare(
      `INSERT INTO materials (version_id, lp, index_code, name, unit, total_qty, unit_price, total_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertDept = db.prepare(
      `INSERT INTO material_depts (material_id, dept_number, dept_name, sub_dept_number, sub_dept_name, qty, value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertChapter = db.prepare(
      `INSERT INTO cost_chapters (version_id, number, name, order_index, total_netto)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertItem = db.prepare(
      `INSERT INTO cost_items (version_id, chapter_id, lp, knr, name, unit, qty, unit_price, total_value_netto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const run = db.transaction(() => {
      const { lastInsertRowid: projectId } = insertProject.run(
        meta.title, meta.client_name, meta.address, meta.investor, meta.contractor_name
      );

      const { lastInsertRowid: versionId } = insertVersion.run(
        projectId, 1, notes, totalNetto, vatRate, vatAmount, totalBrutto,
        materialsFileName, estimateFileName
      );

      // Insert cost chapters and map number → id
      const chapterIdMap: Record<string, number> = {};
      for (const ch of costChapters) {
        const { lastInsertRowid: chId } = insertChapter.run(
          versionId, ch.number, ch.name, ch.order_index, ch.total_netto
        );
        chapterIdMap[ch.number] = Number(chId);
      }

      // Insert cost items
      for (const item of costItems) {
        const chapterId = chapterIdMap[item.chapter_number] ?? null;
        insertItem.run(
          versionId, chapterId, item.lp, item.knr, item.name,
          item.unit, item.qty, item.unit_price, item.total_value_netto
        );
      }

      // Insert materials
      for (const mat of materials) {
        const { lastInsertRowid: matId } = insertMaterial.run(
          versionId, mat.lp, mat.index_code, mat.name,
          mat.unit, mat.total_qty, mat.unit_price, mat.total_value
        );
        for (const dept of mat.depts) {
          insertDept.run(
            matId, dept.dept_number, dept.dept_name,
            dept.sub_dept_number, dept.sub_dept_name,
            dept.qty, dept.value
          );
        }
      }

      return { projectId, versionId };
    });

    const { projectId } = run();
    return NextResponse.json({ projectId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
