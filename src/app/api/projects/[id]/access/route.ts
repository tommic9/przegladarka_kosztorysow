import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/access — assign user to project
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { userId } = await req.json();

  db.prepare(
    "INSERT OR IGNORE INTO project_access (project_id, user_id) VALUES (?, ?)"
  ).run(parseInt(id, 10), userId);

  return NextResponse.json({ ok: true });
}

// DELETE /api/projects/[id]/access — remove user from project
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { userId } = await req.json();

  db.prepare(
    "DELETE FROM project_access WHERE project_id = ? AND user_id = ?"
  ).run(parseInt(id, 10), userId);

  return NextResponse.json({ ok: true });
}
