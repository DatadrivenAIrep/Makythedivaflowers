import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { PATCH } from "@/app/api/admin/orders/[id]/payment/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, payment = "pending") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, payment);
}

it("marks order paid", async () => {
  seed("p1");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "zelle", note: "via Maria" }) }),
    { params: Promise.resolve({ id: "p1" }) },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.order.paymentStatus).toBe("paid");
});

it("returns 400 on invalid method", async () => {
  seed("p2");
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "bitcoin" }) }),
    { params: Promise.resolve({ id: "p2" }) },
  );
  expect(res.status).toBe(400);
});

it("returns 404 on unknown order", async () => {
  const res = await PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "cash" }) }),
    { params: Promise.resolve({ id: "nope" }) },
  );
  expect(res.status).toBe(404);
});
