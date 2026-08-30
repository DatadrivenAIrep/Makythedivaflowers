import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

// Migrations are idempotent but not free: the CREATE TABLE below is a write, and
// this used to run on every single call. During a static build that meant one
// write attempt per prerendered page across 7 parallel workers, which SQLite
// answered with "database is locked". Memoized against the live connection, so
// closeDb() (tests, reconnects) correctly forces a re-run.
let migratedFor: unknown = null;

export function runMigrations(): void {
  const db = getDb();
  if (migratedFor === db) return;
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    db
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((r) => (r as { name: string }).name),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const insert = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  const isApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?");
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    // BEGIN IMMEDIATE grabs the write lock up front so concurrent processes — e.g.
    // `next build`'s parallel workers, each its own process on the same sqlite file
    // — serialize here instead of both running a non-idempotent statement (SQLite
    // has no ALTER TABLE ... ADD COLUMN IF NOT EXISTS). Once we hold the lock,
    // re-check whether another process already applied this file (its ALTER + the
    // schema_migrations row commit atomically together) and skip it if so.
    db.exec("BEGIN IMMEDIATE");
    try {
      if (isApplied.get(f)) {
        db.exec("COMMIT");
        applied.add(f);
        continue;
      }
      db.exec(sql);
      insert.run(f, new Date().toISOString());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    console.log(JSON.stringify({ event: "migration_applied", name: f }));
  }
  migratedFor = db;
}
