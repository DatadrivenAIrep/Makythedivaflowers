import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getMetrics } from "@/lib/metrics-storage";
import { createAccount } from "@/lib/house-account-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("exposes house-account receivables in the KPIs", () => {
  const a = createAccount({ name: "Hotel" });
  getDb().prepare("INSERT INTO house_account_entries (id, account_id, kind, amount_cents, actor, created_at) VALUES ('e1', ?, 'charge', 7000, 't', '2026-09-10T12:00:00Z')").run(a.id);
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 2000, 'open', '[]', '2026-10-01T13:00:00Z')`,
  ).run(a.id);
  const m = getMetrics("90d", new Date("2026-11-01T12:00:00Z"), "es", { customProducts: "P", unknownZone: "Z" });
  expect(m.kpis).toMatchObject({ houseAccountsCents: 7000, houseAccountsOverdueCents: 5000, houseAccountsOverdueCount: 1 });
});
