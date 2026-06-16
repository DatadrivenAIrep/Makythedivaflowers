import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
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
    expect(tables).toContain("settings");
    expect(tables).toContain("product_price_overrides");
  });

  it("is idempotent — running twice records each migration once", () => {
    runMigrations();
    runMigrations();
    const db = getDb();
    const rows = db.prepare("SELECT name FROM schema_migrations ORDER BY name").all() as { name: string }[];
    // Compare against the actual migration files (sorted) so adding a migration
    // doesn't require editing this assertion. Equality also proves idempotency:
    // a double-recorded migration would make rows longer than the file list.
    const files = fs
      .readdirSync(path.join(process.cwd(), "db", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(rows.map((r) => r.name)).toEqual(files);
  });
});

describe("002_messaging migration", () => {
  it("adds messaging_channel + locale to customers", () => {
    runMigrations();
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(customers)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("messaging_channel");
    expect(names).toContain("locale");
  });

  it("adds stripe_checkout_session_id to orders", () => {
    runMigrations();
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain("stripe_checkout_session_id");
  });

  it("creates the messages table", () => {
    runMigrations();
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("messages");
  });
});
