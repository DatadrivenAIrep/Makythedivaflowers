import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function runMigrations(): void {
  const db = getDb();
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
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      insert.run(f, new Date().toISOString());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    console.log(JSON.stringify({ event: "migration_applied", name: f }));
  }
}
