import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const { dispatchOrderReceived, dispatchPaymentConfirmed } = vi.hoisted(() => ({
  dispatchOrderReceived: vi.fn().mockResolvedValue(undefined),
  dispatchPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived, dispatchPaymentConfirmed }));
vi.mock("@/lib/stripe-payment-link", () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({
    id: "cs_test", url: "https://buy.stripe.com/test", expiresAt: 9999999999,
  }),
}));

import { POST } from "@/app/api/admin/orders/[id]/resend/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  dispatchOrderReceived.mockClear();
  dispatchPaymentConfirmed.mockClear();
});
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

it("resends payment_link by regenerating the checkout session and dispatching", async () => {
  seed("r1", "pending");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "payment_link" }) }),
    { params: Promise.resolve({ id: "r1" }) },
  );
  expect(res.status).toBe(200);
  expect(dispatchOrderReceived).toHaveBeenCalled();
});

it("resends confirmation when order is already paid", async () => {
  seed("r2", "paid");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "confirmation" }) }),
    { params: Promise.resolve({ id: "r2" }) },
  );
  expect(res.status).toBe(200);
  expect(dispatchPaymentConfirmed).toHaveBeenCalled();
});

it("returns 409 when asking to resend payment_link for a paid order", async () => {
  seed("r3", "paid");
  const res = await POST(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "payment_link" }) }),
    { params: Promise.resolve({ id: "r3" }) },
  );
  expect(res.status).toBe(409);
});
