import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(process.cwd(), "data", "uploads");

// GET /api/files/[id] — download file
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const fileRecord = db
    .prepare("SELECT * FROM project_files WHERE id = ?")
    .get(parseInt(id, 10)) as
    | { id: number; project_id: number; file_name: string; original_name: string }
    | undefined;

  if (!fileRecord) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Contractors must have access to the project
  if (session.role === "contractor") {
    const access = db
      .prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?")
      .get(fileRecord.project_id, session.userId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = path.join(UPLOADS_DIR, fileRecord.file_name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(fileRecord.file_name).toLowerCase();

  const contentTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".zip": "application/zip",
  };

  const contentType = contentTypes[ext] ?? "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`,
    },
  });
}

// DELETE /api/files/[id] — delete file (admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const fileRecord = db
    .prepare("SELECT * FROM project_files WHERE id = ?")
    .get(parseInt(id, 10)) as
    | { id: number; file_name: string }
    | undefined;

  if (!fileRecord) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete from disk
  const filePath = path.join(UPLOADS_DIR, fileRecord.file_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare("DELETE FROM project_files WHERE id = ?").run(fileRecord.id);

  return NextResponse.json({ ok: true });
}
