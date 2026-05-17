import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDb, closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("runMigrations", () => {
  it("creates the orders, customers, print_jobs and schema_migrations tables", () => {
    runMigrations();
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toContain("orders");
    expect(tables).toContain("customers");
    expect(tables).toContain("print_jobs");
    expect(tables).toContain("schema_migrations");
  });

  it("is idempotent — running twice records the migration once", () => {
    runMigrations();
    runMigrations();
    const db = getDb();
    const rows = db.prepare("SELECT name FROM schema_migrations").all();
    expect(rows.length).toBe(1);
    expect((rows[0] as { name: string }).name).toBe("001_init.sql");
  });
});
