import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { GET } from "@/app/api/admin/occasions/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedCustomer(id: string, name: string, phone: string) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(id, name, phone);
}

function monthDayIn(daysAhead: number): { month: number; day: number } {
  const d = new Date(Date.now() + daysAhead * DAY);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function seed() {
  seedCustomer("c1", "Ana", "5551");
  seedCustomer("c2", "Bea", "5552");
  addImportantDate("c1", { kind: "birthday", ...monthDayIn(2) });
  addImportantDate("c2", { kind: "anniversary", ...monthDayIn(20) });
}

it("defaults to a 30-day window sorted by daysUntil", async () => {
  seed();
  const res = await GET(new Request("http://x/api/admin/occasions"));
  expect(res.status).toBe(200);
  const { occasions } = await res.json();
  expect(occasions.map((o: { customerName: string }) => o.customerName)).toEqual(["Ana", "Bea"]);
});

it("days=7 narrows the window", async () => {
  seed();
  const { occasions } = await (await GET(new Request("http://x/api/admin/occasions?days=7"))).json();
  expect(occasions.map((o: { customerName: string }) => o.customerName)).toEqual(["Ana"]);
});

it("clamps out-of-range days values instead of erroring", async () => {
  seed();
  const big = await (await GET(new Request("http://x/api/admin/occasions?days=9999"))).json();
  expect(big.occasions).toHaveLength(2); // clamped to 366, both still inside

  const zero = await (await GET(new Request("http://x/api/admin/occasions?days=0"))).json();
  expect(zero.occasions.length).toBeLessThanOrEqual(1); // clamped to 1

  const junk = await GET(new Request("http://x/api/admin/occasions?days=abc"));
  expect(junk.status).toBe(200); // falls back to default
});
