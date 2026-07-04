import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("012_customer_crm migration", () => {
  it("adds customers.notes and creates customer_tags", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, notes)
       VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'prefiere tulipanes')`,
    ).run();
    const row = db.prepare("SELECT notes FROM customers WHERE id = 'c1'").get() as { notes: string };
    expect(row.notes).toBe("prefiere tulipanes");

    db.prepare("INSERT INTO customer_tags (customer_id, tag) VALUES ('c1', 'boda')").run();
    const tags = db.prepare("SELECT tag FROM customer_tags WHERE customer_id = 'c1'").all();
    expect(tags).toEqual([{ tag: "boda" }]);
  });

  it("customer_tags PK dedupes (INSERT OR IGNORE is a no-op on duplicates)", () => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES ('c9', 'vip')").run();
    db.prepare("INSERT OR IGNORE INTO customer_tags (customer_id, tag) VALUES ('c9', 'vip')").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM customer_tags WHERE customer_id = 'c9'").get() as { n: number };
    expect(n.n).toBe(1);
  });
});
