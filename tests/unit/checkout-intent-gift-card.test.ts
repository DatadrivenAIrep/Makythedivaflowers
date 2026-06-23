import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { getOrder } from "@/lib/order-storage";

const piCreate = vi.fn(async () => ({ id: "pi_1", client_secret: "cs_1" }));
vi.mock("@/lib/stripe-server", () => ({ stripe: { paymentIntents: { create: piCreate } } }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intent-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function body(code: string) {
  return {
    locale: "es",
    lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    giftCardCode: code,
    form: {
      contact: { email: "a@b.com", phone: "5165550100" },
      delivery: {
        method: "pickup",
        recipient: { name: "María", phone: "5165550100" },
        window: { date: "2026-07-01", slot: "midday" },
        cardMessage: "",
      },
    },
  };
}

async function callIntent(b: unknown) {
  const { POST } = await import("@/app/api/checkout/intent/route");
  return POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
}

describe("intent route with gift card", () => {
  it("full coverage: no Stripe, marks paid by gift card, returns paid:true, debits balance", async () => {
    const card = issueGiftCard({ initialCents: 100000, recipientEmail: "a@b.com" });
    const res = await callIntent(body(card.code));
    const data = await res.json();
    expect(data.paid).toBe(true);
    expect(piCreate).not.toHaveBeenCalled();
    const order = await getOrder(data.orderId);
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.paymentMethod).toBe("gift-card");
    expect(getGiftCardById(card.id)!.balanceCents).toBeLessThan(100000);
  });

  it("partial: Stripe PI created for total minus a small balance; balance not yet debited", async () => {
    const card = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" });
    const res = await callIntent(body(card.code));
    const data = await res.json();
    expect(data.clientSecret).toBe("cs_1");
    expect(piCreate).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const amount = ((piCreate.mock.calls as any)[0][0] as { amount: number }).amount;
    expect(amount).toBeGreaterThan(0);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(500);
    const order = await getOrder(data.orderId);
    expect(order?.giftCardId).toBe(card.id);
    expect(order?.giftCardCents).toBe(500);
  });

  it("rejects an invalid code with 400", async () => {
    const res = await callIntent(body("DIVA-0000-0000"));
    expect(res.status).toBe(400);
  });
});
