import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST } from "@/app/api/admin/orders/[id]/ack/route";
import { isAcknowledged } from "@/lib/order-acknowledgments";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("acknowledges an order and persists the row", async () => {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES ('a1', 'es', 'web', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run();
  const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "a1" }) });
  expect(res.status).toBe(200);
  expect(isAcknowledged("a1")).toBe(true);
});

it("returns 404 for unknown order", async () => {
  const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "nope" }) });
  expect(res.status).toBe(404);
});
