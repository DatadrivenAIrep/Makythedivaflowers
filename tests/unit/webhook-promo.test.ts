import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, listPromos } from "@/lib/promo";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import type { Order } from "@/types/order";

vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe-server", () => ({
  stripe: { webhooks: { constructEvent: (raw: string) => JSON.parse(raw) } },
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-wh-promo-" + process.pid + ".json");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function seedOrderWithPromo(promoId: string, promoCode: string) {
  const order: Order = {
    id: "do_wh_promo",
    source: "web",
    locale: "es",
    lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    fulfillment: {
      method: "pickup",
      recipient: { name: "M", phone: "5165550100" },
      window: { date: "2026-07-01", slot: "midday" },
    },
    contact: { phone: "5165550100", email: "a@b.com" },
    totals: {
      subtotalCents: 20000,
      deliveryCents: 0,
      discountCents: 2000,
      tipCents: 0, taxCents: 1553,
      totalCents: 19553,
    },
    status: "pending",
    paymentStatus: "pending",
    promoId,
    promoCode,
    createdAt: "2026-06-22T00:00:00Z",
    updatedAt: "2026-06-22T00:00:00Z",
  };
  await saveOrder(order);
  await updateOrderPaymentIntent("do_wh_promo", "pi_promo");
}

async function fireWebhook() {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const evt = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_promo" } },
  });
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: evt,
    }),
  );
}

describe("webhook commits promo redemption", () => {
  it("records the redemption on payment_intent.succeeded", async () => {
    const p = createPromo({ code: "WH10", kind: "percent", value: 10 });
    await seedOrderWithPromo(p.id, p.code);
    await fireWebhook();
    const row = listPromos().find((x) => x.id === p.id);
    expect(row?.redemptionCount).toBe(1);
    expect(row?.discountedCents).toBe(2000);
  });

  it("does not double-count when Stripe replays the event", async () => {
    const p = createPromo({ code: "WH10B", kind: "percent", value: 10 });
    await seedOrderWithPromo(p.id, p.code);
    await fireWebhook();
    await fireWebhook();
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("still marks the order paid when the promo is already exhausted", async () => {
    // The buyer's money is taken; a redemption-limit race must not fail the
    // webhook or leave the order looking unpaid.
    const p = createPromo({ code: "WH1", kind: "percent", value: 10, maxRedemptions: 1 });
    await seedOrderWithPromo(p.id, p.code);
    const { redeemPromo } = await import("@/lib/promo");
    redeemPromo(p.id, "some-other-order", 2000);

    const res = await fireWebhook();
    expect(res.status).toBe(200);
    const { getOrder } = await import("@/lib/order-storage");
    expect((await getOrder("do_wh_promo"))?.paymentStatus).toBe("paid");
  });
});
