import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/queue/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns the queue payload shape", async () => {
  // seed one delivery-today-undispatched order
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('q1', 'es', 'walk-in', 'Maria', '555', '555', 'delivery', '2026-05-25', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run();
  const res = await GET();
  const body = await res.json();
  expect(body.generatedAt).toBeTruthy();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items[0].orderId).toBe("q1");
  expect(body.items[0].reason).toBe("delivery_today_undispatched");
});
