import bcrypt from "bcryptjs";
import db from "../lib/db";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const adminName = process.env.ADMIN_NAME || "Administrator";

async function seed() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  if (existing) {
    console.log(`Admin ${adminEmail} already exists.`);
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 12);
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')"
  ).run(adminEmail, hash, adminName);

  console.log(`✓ Admin created: ${adminEmail} / ${adminPassword}`);
}

seed().catch(console.error);
