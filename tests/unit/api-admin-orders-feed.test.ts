import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/feed/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns events for orders in the window", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('f1', 'es', 'web', 'X', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,15000, 'pending', 'pending', '2026-05-25T13:00:00Z', '2026-05-25T13:00:00Z')`,
  ).run();
  const res = await GET(new Request("http://x/api/admin/orders/feed"));
  const body = await res.json();
  expect(body.events.some((e: { orderId: string }) => e.orderId === "f1")).toBe(true);
});

it("respects sinceHours query param", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('f_old', 'es', 'web', 'X', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,15000, 'pending', 'pending', '2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')`,
  ).run();
  const res = await GET(new Request("http://x/api/admin/orders/feed?sinceHours=1"));
  const body = await res.json();
  expect(body.events.some((e: { orderId: string }) => e.orderId === "f_old")).toBe(false);
});
