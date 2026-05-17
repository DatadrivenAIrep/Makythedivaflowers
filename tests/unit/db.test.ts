import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDb, closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("db", () => {
  it("getDb returns a working sqlite handle", () => {
    const db = getDb();
    db.exec("CREATE TABLE t (x INTEGER)");
    db.prepare("INSERT INTO t (x) VALUES (?)").run(1);
    const row = db.prepare("SELECT x FROM t").get() as { x: number };
    expect(row.x).toBe(1);
  });

  it("getDb is idempotent within a process", () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it("WAL pragma is enabled in non-memory mode", () => {
    vi.stubEnv("SQLITE_FILE", "/tmp/diva-wal-test.sqlite");
    closeDb();
    const db = getDb();
    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");
  });
});
