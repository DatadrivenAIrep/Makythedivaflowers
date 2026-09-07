import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos } from "@/lib/promo";
import { getOrder } from "@/lib/order-storage";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }),
      },
    },
  },
}));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => ({ id: "pj_test" })) }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intake-promo-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// A $50 custom line, picked up (no delivery), so the math is easy to eyeball.
const SUBTOTAL = 5000;

function intakeBody(
  extra: Record<string, unknown> = {},
  payment: Record<string, unknown> = { status: "paid", method: "cash" },
) {
  return {
    source: "walk-in",
    customer: { name: "Cliente", phone: "5165550100", messagingChannel: "none" },
    fulfillment: { method: "pickup", recipient: { name: "Cliente", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    lines: [{ kind: "custom", title: "Ramo", priceCents: SUBTOTAL, qty: 1 }],
    payment,
    ...extra,
  };
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/admin/orders/route");
  return POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

describe("intake order with a promo code", () => {
  it("applies the discount to the total and stores the promo on the order", async () => {
    const p = createPromo({ code: "TEN", kind: "percent", value: 10 });
    const res = await post(intakeBody({ promoCode: "ten" }));
    expect(res.status).toBe(201);
    const { orderId } = await res.json();
    const order = await getOrder(orderId);

    const discount = Math.round(SUBTOTAL * 0.1); // 500
    const taxable = SUBTOTAL - discount; // 4500
    expect(order?.totals.discountCents).toBe(discount);
    expect(order?.totals.totalCents).toBe(taxable + Math.round(taxable * 0.08625));
    expect(order?.promoId).toBe(p.id);
    expect(order?.promoCode).toBe("TEN");
  });

  it("redeems the code when the order is paid on the spot", async () => {
    const p = createPromo({ code: "PAIDNOW", kind: "percent", value: 10 });
    await post(intakeBody({ promoCode: "PAIDNOW" }, { status: "paid", method: "cash" }));
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("does not redeem the code while payment is still pending", async () => {
    const p = createPromo({ code: "LATER", kind: "percent", value: 10 });
    const res = await post(intakeBody({ promoCode: "LATER" }, { status: "pending" }));
    expect(res.status).toBe(201);
    const { orderId } = await res.json();
    // The discount still prices the order, but the code is only burned once paid.
    expect((await getOrder(orderId))?.totals.discountCents).toBe(Math.round(SUBTOTAL * 0.1));
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(0);
  });

  it("rejects the order when the code is not valid", async () => {
    const res = await post(intakeBody({ promoCode: "NOSUCHCODE" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.formErrors).toContain("promo_invalid");
  });

  it("recomputes the discount server-side rather than trusting the client", async () => {
    // The client only sends a code; a tampered discount in the totals override
    // must never dictate the price.
    createPromo({ code: "FIXED5", kind: "fixed", value: 500 });
    const res = await post(intakeBody({ promoCode: "FIXED5", totalsOverride: { discountCents: 999999 } }));
    const { orderId } = await res.json();
    expect((await getOrder(orderId))?.totals.discountCents).toBe(500);
  });

  it("applies no discount when no code is sent", async () => {
    const res = await post(intakeBody());
    const { orderId } = await res.json();
    const order = await getOrder(orderId);
    expect(order?.totals.discountCents).toBe(0);
    expect(order?.promoCode).toBeUndefined();
  });
});
