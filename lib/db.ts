import "server-only";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// node:sqlite (Node 22.5+) is loaded via createRequire to bypass Vite's
// bundler — bundlers can't resolve Node built-ins. In Node 22.x the module
// is experimental and requires --experimental-sqlite at runtime; package.json
// scripts pass it via NODE_OPTIONS.
const require = createRequire(import.meta.url);
type DatabaseSyncType = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
};
type SqliteModule = { DatabaseSync: new (path: string) => DatabaseSyncType };

let dbInstance: DatabaseSyncType | null = null;

function resolveFile(): string {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  if (file === ":memory:") return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

export function getDb(): DatabaseSyncType {
  if (dbInstance) return dbInstance;
  const sqlite = require("node:sqlite") as SqliteModule;
  const file = resolveFile();
  dbInstance = new sqlite.DatabaseSync(file);
  if (file !== ":memory:") {
    dbInstance.exec("PRAGMA journal_mode = WAL");
  }
  dbInstance.exec("PRAGMA foreign_keys = ON");
  dbInstance.exec("PRAGMA busy_timeout = 5000");
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
