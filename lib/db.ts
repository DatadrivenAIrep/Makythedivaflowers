import "server-only";
import fs from "node:fs";
import path from "node:path";
import { enableWalWithRetry } from "@/lib/db-wal";

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
  // busy_timeout MUST come first. Switching to WAL takes an exclusive lock, and
  // with the default zero timeout it fails instantly rather than waiting — which
  // is what broke static builds, where 7 workers open the database at once.
  dbInstance.exec("PRAGMA busy_timeout = 10000");
  if (file !== ":memory:") {
    // Retried rather than executed once: the journal-mode switch is the one
    // statement busy_timeout does not cover, and a fresh database opened by
    // seven parallel build workers loses that race often enough to break a
    // deploy. See lib/db-wal.ts.
    enableWalWithRetry((sql) => dbInstance!.exec(sql));
  }
  dbInstance.exec("PRAGMA foreign_keys = ON");
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
