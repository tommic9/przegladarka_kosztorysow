import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/settlements/[id] — update status (admin only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { status: string };

  if (!["pending", "paid"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  db.prepare("UPDATE settlements SET status = ? WHERE id = ?").run(body.status, parseInt(id, 10));

  return NextResponse.json({ ok: true });
}

// DELETE /api/settlements/[id] — delete settlement (admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  db.prepare("DELETE FROM settlements WHERE id = ?").run(parseInt(id, 10));

  return NextResponse.json({ ok: true });
}
