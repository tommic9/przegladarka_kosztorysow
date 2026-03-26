import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(process.cwd(), "data", "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// GET /api/projects/[id]/files — list files for a project
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id, 10);

  if (session.role === "contractor") {
    const access = db
      .prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?")
      .get(projectId, session.userId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = db
    .prepare("SELECT * FROM project_files WHERE project_id = ? ORDER BY uploaded_at DESC")
    .all(projectId);

  return NextResponse.json({ files });
}

// POST /api/projects/[id]/files — upload a file (admin only)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const description = (formData.get("description") as string | null) ?? "";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  ensureUploadsDir();

  const ext = path.extname(file.name);
  const storedName = `${projectId}_${Date.now()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const result = db
    .prepare(
      "INSERT INTO project_files (project_id, file_name, original_name, description) VALUES (?, ?, ?, ?)"
    )
    .run(projectId, storedName, file.name, description || null);

  const inserted = db
    .prepare("SELECT * FROM project_files WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json({ file: inserted });
}
