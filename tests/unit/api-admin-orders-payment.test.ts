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

function seedTotal(id: string, totalCents: number) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       ?,0,0,?, 'pending', 'pending', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, totalCents, totalCents);
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
}

it("records a deposit and leaves the order pending", async () => {
  seedTotal("dep1", 20000);
  const res = await patch("dep1", { deposit: { amountCents: 5000, method: "zelle" } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.order.paymentStatus).toBe("pending");
  expect(body.order.amountPaidCents).toBe(5000);
});

it("rejects a deposit above the balance with 400", async () => {
  seedTotal("dep2", 20000);
  const res = await patch("dep2", { deposit: { amountCents: 25000, method: "cash" } });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("deposit_exceeds_balance");
});

it("rejects a deposit on a paid order with 409", async () => {
  seed("dep3", "paid");
  const res = await patch("dep3", { deposit: { amountCents: 100, method: "cash" } });
  expect(res.status).toBe(409);
});
