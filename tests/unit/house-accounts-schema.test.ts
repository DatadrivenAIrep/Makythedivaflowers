import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { orderToRow, rowToOrder, type OrderRow } from "@/lib/order-row";
import { makeOrder } from "../factories/order";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function tables(): string[] {
  return (getDb().prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
}

describe("migration 030", () => {
  it("creates the house account tables", () => {
    const t = tables();
    for (const name of ["house_accounts", "house_account_contacts", "house_account_entries", "house_account_statements", "house_account_sends", "statement_number_seq"]) {
      expect(t).toContain(name);
    }
    const seq = getDb().prepare("SELECT last_value FROM statement_number_seq").get() as { last_value: number };
    expect(seq.last_value).toBe(1000);
  });

  it("adds orders.house_account_id and maps it both ways", () => {
    const cols = (getDb().prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("house_account_id");
    const o = { ...makeOrder({ id: "o1" }), houseAccountId: "ha_x", paymentMethod: "house-account" as const };
    const row = orderToRow(o);
    expect(row.house_account_id).toBe("ha_x");
    expect(rowToOrder(row as OrderRow).houseAccountId).toBe("ha_x");
    expect(rowToOrder({ ...row, house_account_id: null } as OrderRow).houseAccountId).toBeUndefined();
  });

  it("stripe_session_id is unique on entries", () => {
    const db = getDb();
    db.prepare("INSERT INTO house_accounts (id, name, created_at, updated_at) VALUES ('ha_1','Org','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')").run();
    const ins = db.prepare("INSERT OR IGNORE INTO house_account_entries (id, account_id, kind, amount_cents, stripe_session_id, actor, created_at) VALUES (?, 'ha_1', 'payment', -100, 'cs_1', 'stripe', '2026-10-01T00:00:00Z')");
    expect(ins.run("e1").changes).toBe(1);
    expect(ins.run("e2").changes).toBe(0);
  });
});
