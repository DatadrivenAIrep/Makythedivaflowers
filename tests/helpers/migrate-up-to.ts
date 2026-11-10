import fs from "node:fs";
import path from "node:path";
import type { getDb } from "@/lib/db";

type DatabaseSync = ReturnType<typeof getDb>;

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/** Applies db/migrations/*.sql in order up to and including `lastFile`, recording
 *  each in schema_migrations like runMigrations does. */
export function applyMigrationsUpTo(db: DatabaseSync, lastFile: string): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (!files.includes(lastFile)) throw new Error(`unknown migration ${lastFile}`);
  const insert = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const f of files) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    insert.run(f, new Date().toISOString());
    if (f === lastFile) break;
  }
}
