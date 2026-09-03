import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listGiftCards, getGiftCardByPaymentIntent } from "@/lib/gift-card-storage";

const createPI = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    paymentIntents: { create: createPI },
    webhooks: { constructEvent: (raw: string) => JSON.parse(raw) },
  },
}));
vi.mock("@/lib/gift-card-notifications", () => ({
  notifyGiftCardIssued: vi.fn(async () => ({ sent: true })),
}));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gcp-" + process.pid + ".json");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  createPI.mockReset();
  createPI.mockResolvedValue({ id: "pi_gc_web", client_secret: "cs_gc" });
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const body = {
  locale: "en",
  amountCents: 10000,
  recipientEmail: "her@example.com",
  recipientName: "Lola",
  fromLabel: "Santiago",
  personalMessage: "Happy birthday",
  purchaserEmail: "buyer@example.com",
};

async function post(payload: unknown) {
  const { POST } = await import("@/app/api/checkout/gift-card-purchase/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

async function fireWebhook(paymentIntentId = "pi_gc_web") {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: paymentIntentId,
            metadata: {
              kind: "gift_card",
              amountCents: "10000",
              recipientEmail: "her@example.com",
              recipientName: "Lola",
              fromLabel: "Santiago",
              personalMessage: "Happy birthday",
              purchaserEmail: "buyer@example.com",
              locale: "en",
            },
          },
        },
      }),
    }),
  );
}

describe("POST /api/checkout/gift-card-purchase", () => {
  it("charges the chosen amount", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(createPI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000, currency: "usd" }),
      expect.anything(),
    );
  });

  it("does not issue the card before the payment succeeds", async () => {
    await post(body);
    expect(listGiftCards().cards).toHaveLength(0);
  });

  it("carries what it needs to issue later in the payment metadata", async () => {
    await post(body);
    const [args] = createPI.mock.calls[0];
    expect(args.metadata.kind).toBe("gift_card");
    expect(args.metadata.recipientEmail).toBe("her@example.com");
    expect(args.metadata.amountCents).toBe("10000");
  });

  it("refuses an amount outside what the shop sells", async () => {
    expect((await post({ ...body, amountCents: 100 })).status).toBe(400);
    expect((await post({ ...body, amountCents: 100000 })).status).toBe(400);
  });

  it("refuses a bad recipient address", async () => {
    expect((await post({ ...body, recipientEmail: "not-an-email" })).status).toBe(400);
  });

  it("does not let the buyer set the price to zero", async () => {
    expect((await post({ ...body, amountCents: 0 })).status).toBe(400);
  });
});

describe("gift card issued on payment", () => {
  it("issues the card when the payment succeeds", async () => {
    await fireWebhook();
    const card = getGiftCardByPaymentIntent("pi_gc_web");
    expect(card).toBeTruthy();
    expect(card!.initialCents).toBe(10000);
    expect(card!.recipientEmail).toBe("her@example.com");
  });

  it("emails the recipient once", async () => {
    const { notifyGiftCardIssued } = await import("@/lib/gift-card-notifications");
    await fireWebhook();
    expect(notifyGiftCardIssued).toHaveBeenCalledTimes(1);
  });

  it("does not issue a second card when Stripe replays the event", async () => {
    await fireWebhook();
    await fireWebhook();
    expect(listGiftCards().cards).toHaveLength(1);
  });

  it("leaves ordinary order payments alone", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: JSON.stringify({
          type: "payment_intent.succeeded",
          data: { object: { id: "pi_regular_order", metadata: {} } },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(listGiftCards().cards).toHaveLength(0);
  });
});
