import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// GET /api/users — list all contractors (admin only)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = db
    .prepare("SELECT id, email, name, role, created_at FROM users WHERE role = 'contractor' ORDER BY name")
    .all();

  return NextResponse.json({ users });
}

// POST /api/users — create contractor
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Email, hasło i imię są wymagane" }, { status: 400 });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return NextResponse.json({ error: "Email już istnieje" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'contractor')")
    .run(email, hash, name);

  return NextResponse.json({ userId: lastInsertRowid }, { status: 201 });
}
