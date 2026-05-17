import "server-only";
import Database, { type Database as DB } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let dbInstance: DB | null = null;

function resolveFile(): string {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  if (file === ":memory:") return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

export function getDb(): DB {
  if (dbInstance) return dbInstance;
  const file = resolveFile();
  dbInstance = new Database(file);
  if (file !== ":memory:") {
    dbInstance.pragma("journal_mode = WAL");
  }
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("busy_timeout = 5000");
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
