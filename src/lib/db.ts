import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "database.sqlite");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'contractor')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    client_name TEXT,
    address TEXT,
    investor TEXT,
    contractor_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT,
    total_netto REAL,
    vat_rate REAL,
    vat_amount REAL,
    total_brutto REAL,
    materials_file_name TEXT,
    estimate_file_name TEXT
  );

  CREATE TABLE IF NOT EXISTS project_access (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
    lp INTEGER,
    index_code TEXT,
    name TEXT NOT NULL,
    unit TEXT,
    total_qty REAL,
    unit_price REAL,
    total_value REAL
  );

  CREATE TABLE IF NOT EXISTS material_depts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    dept_number TEXT NOT NULL,
    dept_name TEXT NOT NULL,
    sub_dept_number TEXT,
    sub_dept_name TEXT,
    qty REAL,
    value REAL
  );

  CREATE TABLE IF NOT EXISTS cost_chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    total_netto REAL
  );

  CREATE TABLE IF NOT EXISTS cost_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES cost_chapters(id) ON DELETE SET NULL,
    lp INTEGER,
    knr TEXT,
    name TEXT NOT NULL,
    unit TEXT,
    qty REAL,
    unit_price REAL,
    total_value_netto REAL,
    measurement TEXT
  );
`);

// Migrations — add columns that may not exist in older databases
try { db.exec(`ALTER TABLE cost_items ADD COLUMN measurement TEXT`); } catch { /* already exists */ }

export default db;

// Typed query helpers
export type User = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: "admin" | "contractor";
  created_at: string;
};

export type Project = {
  id: number;
  title: string;
  client_name: string | null;
  address: string | null;
  investor: string | null;
  contractor_name: string | null;
  created_at: string;
};

export type ProjectVersion = {
  id: number;
  project_id: number;
  version_number: number;
  uploaded_at: string;
  notes: string | null;
  total_netto: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  total_brutto: number | null;
  materials_file_name: string | null;
  estimate_file_name: string | null;
};

export type Material = {
  id: number;
  version_id: number;
  lp: number | null;
  index_code: string | null;
  name: string;
  unit: string | null;
  total_qty: number | null;
  unit_price: number | null;
  total_value: number | null;
};

export type MaterialDept = {
  id: number;
  material_id: number;
  dept_number: string;
  dept_name: string;
  sub_dept_number: string | null;
  sub_dept_name: string | null;
  qty: number | null;
  value: number | null;
};

export type CostChapter = {
  id: number;
  version_id: number;
  number: string;
  name: string;
  order_index: number;
  total_netto: number | null;
};

export type CostItem = {
  id: number;
  version_id: number;
  chapter_id: number | null;
  lp: number | null;
  knr: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unit_price: number | null;
  total_value_netto: number | null;
  measurement: string | null;
};
