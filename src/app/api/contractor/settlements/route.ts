import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// GET /api/contractor/settlements — all settlements for the current contractor
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "contractor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settlements = db
    .prepare(
      `SELECT s.*, p.title as project_title
       FROM settlements s
       JOIN projects p ON p.id = s.project_id
       WHERE s.contractor_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(session.userId);

  return NextResponse.json({ settlements });
}
