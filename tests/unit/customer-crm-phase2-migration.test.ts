import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("013_customer_crm_phase2 migration", () => {
  it("creates customer_important_dates with all columns", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO customer_important_dates (id, customer_id, kind, label, month, day, year, created_at)
       VALUES ('cid_1', 'c1', 'birthday', 'esposa María', 3, 15, 1985, '2026-07-04T00:00:00Z')`,
    ).run();
    const row = db.prepare("SELECT * FROM customer_important_dates WHERE id = 'cid_1'").get() as {
      kind: string; label: string; month: number; day: number; year: number;
    };
    expect(row.kind).toBe("birthday");
    expect(row.label).toBe("esposa María");
    expect(row.month).toBe(3);
    expect(row.day).toBe(15);
    expect(row.year).toBe(1985);
  });

  it("creates customer_preferences with composite PK deduping", () => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES ('c1', 'dislike', 'lirios')").run();
    db.prepare("INSERT OR IGNORE INTO customer_preferences (customer_id, kind, value) VALUES ('c1', 'dislike', 'lirios')").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM customer_preferences").get() as { n: number };
    expect(n.n).toBe(1);
  });
});
