import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — full project with latest version data
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = parseInt(id, 10);

  // Check access
  if (session.role === "contractor") {
    const access = db
      .prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?")
      .get(projectId, session.userId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get all versions
  const versions = db
    .prepare("SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC")
    .all(projectId);

  // Get latest version data
  const latestVersion = versions[0] as { id: number } | undefined;
  let materials: unknown[] = [];
  let depts: unknown[] = [];
  let chapters: unknown[] = [];
  let items: unknown[] = [];

  if (latestVersion) {
    materials = db
      .prepare("SELECT * FROM materials WHERE version_id = ? ORDER BY lp")
      .all(latestVersion.id);

    depts = db
      .prepare(
        `SELECT md.* FROM material_depts md
         JOIN materials m ON m.id = md.material_id
         WHERE m.version_id = ?`
      )
      .all(latestVersion.id);

    chapters = db
      .prepare("SELECT * FROM cost_chapters WHERE version_id = ? ORDER BY order_index")
      .all(latestVersion.id);

    items = db
      .prepare("SELECT * FROM cost_items WHERE version_id = ? ORDER BY lp")
      .all(latestVersion.id);
  }

  // Get assigned users (admin only)
  let assignedUsers: unknown[] = [];
  if (session.role === "admin") {
    assignedUsers = db
      .prepare(
        `SELECT u.id, u.email, u.name FROM users u
         JOIN project_access pa ON pa.user_id = u.id
         WHERE pa.project_id = ?`
      )
      .all(projectId);
  }

  return NextResponse.json({
    project,
    versions,
    materials,
    depts,
    chapters,
    items,
    assignedUsers,
  });
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  db.prepare("DELETE FROM projects WHERE id = ?").run(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
