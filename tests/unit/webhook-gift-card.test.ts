import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import type { Order } from "@/types/order";

vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));
// The webhook verifies via stripe.webhooks.constructEvent(body, signature, secret) (synchronous).
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    webhooks: { constructEvent: (raw: string) => JSON.parse(raw) },
  },
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-wh-gc-" + process.pid + ".json");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function seedPartialOrder(cardId: string) {
  const order: Order = {
    id: "do_wh", source: "web", locale: "es",
    // real product id so the webhook's internal GA4 payload builder resolves the line
    lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "M", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    contact: { phone: "5165550100", email: "a@b.com" },
    totals: { subtotalCents: 20000, deliveryCents: 0, taxCents: 1725, totalCents: 21725 },
    status: "pending", paymentStatus: "pending",
    giftCardId: cardId, giftCardCents: 500,
    createdAt: "2026-06-22T00:00:00Z", updatedAt: "2026-06-22T00:00:00Z",
  };
  await saveOrder(order);
  await updateOrderPaymentIntent("do_wh", "pi_wh");
}

describe("webhook commits gift card redemption", () => {
  it("debits the gift card once on payment_intent.succeeded", async () => {
    const card = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" });
    await seedPartialOrder(card.id);
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const evt = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_wh" } } });
    const req = new Request("http://t", { method: "POST", headers: { "stripe-signature": "sig" }, body: evt });
    await POST(req);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
    // replaying the same event must not double-debit
    await POST(new Request("http://t", { method: "POST", headers: { "stripe-signature": "sig" }, body: evt }));
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
  });
});
