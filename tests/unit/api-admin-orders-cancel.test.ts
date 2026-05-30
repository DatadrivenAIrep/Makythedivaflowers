import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { PATCH } from "@/app/api/admin/orders/[id]/cancel/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, status = "pending", paymentStatus = "paid") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status, paymentStatus);
}

function call(id: string, body: unknown) {
  return PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
}

it("cancels a pending order", async () => {
  seed("o1");
  const res = await call("o1", { refund: false });
  expect(res.status).toBe(200);
  const { order } = await res.json();
  expect(order.status).toBe("canceled");
  expect(order.paymentStatus).toBe("paid");
});

it("cancels and refunds a paid order", async () => {
  seed("o2", "preparing", "paid");
  const res = await call("o2", { refund: true });
  expect(res.status).toBe(200);
  const { order } = await res.json();
  expect(order.status).toBe("canceled");
  expect(order.paymentStatus).toBe("refunded");
});

it("rejects refund on an unpaid order", async () => {
  seed("o3", "pending", "pending");
  const res = await call("o3", { refund: true });
  expect(res.status).toBe(400);
});

it("rejects canceling a delivered order", async () => {
  seed("o4", "delivered", "paid");
  const res = await call("o4", { refund: false });
  expect(res.status).toBe(400);
});

it("returns 404 for unknown order", async () => {
  const res = await call("nope", { refund: false });
  expect(res.status).toBe(404);
});

it("returns 400 on invalid body", async () => {
  seed("o5");
  const res = await call("o5", { foo: "bar" });
  expect(res.status).toBe(400);
});
