import "server-only";
import fs from "node:fs";
import path from "node:path";

// node:sqlite (Node 22.5+) is loaded via process.getBuiltinModule (Node 22.3+)
// to bypass all bundlers — Turbopack/Vite/Webpack do not statically analyze
// this call so the module stays out of the bundle and is resolved at runtime.
// In Node 22.x the module is experimental and requires --experimental-sqlite;
// package.json scripts set NODE_OPTIONS for dev/start/test/migrate.

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

type ProcessWithBuiltin = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

function loadSqlite(): SqliteModule {
  const p = process as ProcessWithBuiltin;
  if (typeof p.getBuiltinModule === "function") {
    const mod = p.getBuiltinModule("node:sqlite") as SqliteModule | undefined;
    if (mod && mod.DatabaseSync) return mod;
  }
  // Fallback for environments without process.getBuiltinModule (Node < 22.3).
  // The string is built dynamically so bundlers cannot resolve it statically.
  const moduleId = ["node", "sqlite"].join(":");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
  const dynamicRequire = (0, eval)("require") as NodeRequire;
  return dynamicRequire(moduleId) as SqliteModule;
}

let dbInstance: DatabaseSyncType | null = null;

function resolveFile(): string {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  if (file === ":memory:") return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

export function getDb(): DatabaseSyncType {
  if (dbInstance) return dbInstance;
  const sqlite = loadSqlite();
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
