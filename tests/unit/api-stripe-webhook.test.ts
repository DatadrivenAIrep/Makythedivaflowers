import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    webhooks: { constructEvent },
  },
}));

// Stub the email notification module so tests don't load `server-only` or hit Resend.
const notifyOrderPaidMock = vi.fn();
vi.mock("@/lib/order-notifications", () => ({
  notifyOrderPaid: notifyOrderPaidMock,
}));

const enqueuePrintJobMock = vi.fn();
vi.mock("@/lib/print-queue", () => ({
  enqueuePrintJob: enqueuePrintJobMock,
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-webhook-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  constructEvent.mockReset();
  notifyOrderPaidMock.mockReset();
  enqueuePrintJobMock.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function makeReq(body: string, sig: string | null = "test_sig") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig !== null) headers["stripe-signature"] = sig;
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

function makeOrder(id: string, piId: string, paymentStatus: Order["paymentStatus"] = "pending"): Order {
  return {
    id,
    source: "web",
    locale: "en",
    lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, taxCents: 173, totalCents: 2173 },
    stripePaymentIntentId: piId,
    status: "pending",
    paymentStatus,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
}

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}", null));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification throws", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(400);
  });

  it("returns 200 and updates order to paid on payment_intent.succeeded", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
    const o = await getOrder("o1");
    expect(o?.status).toBe("paid");
    // Notification fires exactly once on the pending → paid transition.
    expect(notifyOrderPaidMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and updates order to failed on payment_intent.payment_failed", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.status).toBe("failed");
  });

  it("returns 200 and updates order to canceled on payment_intent.canceled", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.canceled",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.status).toBe("canceled");
  });

  it("returns 200 silently on unknown event types", async () => {
    constructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
  });

  it("is idempotent: same event applied twice is a no-op", async () => {
    await saveOrder(makeOrder("o1", "pi_111", "paid"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    await POST(makeReq("{}"));
    const o = await getOrder("o1");
    expect(o?.paymentStatus).toBe("paid");
    // Order was already paid before either event; no notification should fire.
    expect(notifyOrderPaidMock).not.toHaveBeenCalled();
  });

  it("returns 200 silently when PI id has no matching order", async () => {
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_does_not_exist" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
  });

  it("enqueues a print job on pending → paid transition", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    expect(enqueuePrintJobMock).toHaveBeenCalledTimes(1);
    expect(enqueuePrintJobMock.mock.calls[0][0].id).toBe("o1");
  });

  it("does not enqueue a print job for duplicate webhooks (already paid)", async () => {
    await saveOrder(makeOrder("o1", "pi_111", "paid"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    expect(enqueuePrintJobMock).not.toHaveBeenCalled();
  });

  it("returns 200 even when enqueuePrintJob throws (best-effort)", async () => {
    await saveOrder(makeOrder("o1", "pi_111"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_111" } },
    });
    enqueuePrintJobMock.mockRejectedValue(new Error("disk full"));
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
    expect(notifyOrderPaidMock).toHaveBeenCalledTimes(1);
  });
});
