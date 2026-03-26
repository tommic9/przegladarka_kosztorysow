import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/settlements — list settlements for a project (admin only)
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);

  const settlements = db
    .prepare(
      `SELECT s.*, u.name as contractor_name, u.email as contractor_email
       FROM settlements s
       JOIN users u ON u.id = s.contractor_id
       WHERE s.project_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(projectId);

  return NextResponse.json({ settlements });
}

// POST /api/projects/[id]/settlements — create settlement (admin only)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    contractor_id: number;
    description: string;
    amount: number;
  };

  if (!body.contractor_id || !body.description || body.amount === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const result = db
    .prepare(
      "INSERT INTO settlements (project_id, contractor_id, description, amount) VALUES (?, ?, ?, ?)"
    )
    .run(projectId, body.contractor_id, body.description, body.amount);

  const inserted = db
    .prepare(
      `SELECT s.*, u.name as contractor_name FROM settlements s
       JOIN users u ON u.id = s.contractor_id WHERE s.id = ?`
    )
    .get(result.lastInsertRowid);

  return NextResponse.json({ settlement: inserted });
}
