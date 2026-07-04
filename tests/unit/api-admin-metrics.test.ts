import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/metrics/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedPaid(id: string, daysAgo: number, paid: number) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?, 'delivered', 'paid', ?, ?)`,
  ).run(id, paid, paid, at, at);
}

it("returns the metrics payload for a valid range", async () => {
  seedPaid("o1", 5, 6000);
  seedPaid("o2", 400, 9999); // outside 90d
  const res = await GET(new Request("http://x/api/admin/metrics?range=90d"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.range).toBe("90d");
  expect(body.kpis.revenueCents).toBe(6000);
  expect(body.monthly).toHaveLength(12);
  expect(Array.isArray(body.topProducts)).toBe(true);
  expect(Array.isArray(body.byZone)).toBe(true);
});

it("falls back to 90d on an invalid range and honors range=all", async () => {
  seedPaid("o1", 5, 6000);
  seedPaid("o2", 400, 4000);
  const bad = await (await GET(new Request("http://x/api/admin/metrics?range=bogus"))).json();
  expect(bad.range).toBe("90d");
  expect(bad.kpis.revenueCents).toBe(6000);

  const all = await (await GET(new Request("http://x/api/admin/metrics?range=all"))).json();
  expect(all.range).toBe("all");
  expect(all.kpis.revenueCents).toBe(10000);
});
