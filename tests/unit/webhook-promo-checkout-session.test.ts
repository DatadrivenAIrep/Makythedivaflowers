import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos } from "@/lib/promo";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(async () => {}) }));
vi.mock("@/lib/on-web-order-paid", () => ({ onWebOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe-server", () => ({
  stripe: { webhooks: { constructEvent: (raw: string) => JSON.parse(raw) } },
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-wh-cs-promo-" + process.pid + ".json");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function seedLinkOrder(id: string, sessionId: string, promoId: string, promoCode: string) {
  const order: Order = {
    id,
    source: "walk-in", // intake order paid via a Stripe payment link
    locale: "es",
    lines: [{ kind: "custom", title: "Ramo", priceCents: 20000, qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "M", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    contact: { name: "M", phone: "5165550100" },
    totals: { subtotalCents: 20000, deliveryCents: 0, discountCents: 2000, tipCents: 0, taxCents: 1553, totalCents: 19553 },
    status: "pending",
    paymentStatus: "pending",
    promoId,
    promoCode,
    stripeCheckoutSessionId: sessionId,
    createdAt: "2026-06-22T00:00:00Z",
    updatedAt: "2026-06-22T00:00:00Z",
  };
  await saveOrder(order);
}

async function fire(sessionId: string, orderId: string) {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const evt = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: sessionId, metadata: { orderId } } },
  });
  return POST(new Request("http://t", { method: "POST", headers: { "stripe-signature": "sig" }, body: evt }));
}

describe("webhook redeems promo on checkout.session.completed (payment link)", () => {
  it("records the redemption and marks the order paid", async () => {
    const p = createPromo({ code: "LINK10", kind: "percent", value: 10 });
    await seedLinkOrder("do_cs_promo", "cs_1", p.id, p.code);
    const res = await fire("cs_1", "do_cs_promo");
    expect(res.status).toBe(200);
    expect((await getOrder("do_cs_promo"))?.paymentStatus).toBe("paid");
    const row = listPromos().find((x) => x.id === p.id);
    expect(row?.redemptionCount).toBe(1);
    expect(row?.discountedCents).toBe(2000);
  });

  it("does not double-count when Stripe replays the event", async () => {
    const p = createPromo({ code: "LINK10B", kind: "percent", value: 10 });
    await seedLinkOrder("do_cs_promo2", "cs_2", p.id, p.code);
    await fire("cs_2", "do_cs_promo2");
    await fire("cs_2", "do_cs_promo2");
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });
});
