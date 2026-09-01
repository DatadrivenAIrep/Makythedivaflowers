import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveOrder, getOrder, updateOrderCheckoutSessionId } from "@/lib/order-storage";
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

const dispatchPaymentConfirmedMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchPaymentConfirmed: dispatchPaymentConfirmedMock,
}));

const onWebOrderPaidMock = vi.fn();
vi.mock("@/lib/on-web-order-paid", () => ({
  onWebOrderPaid: onWebOrderPaidMock,
}));

const TEST_FILE = path.join(os.tmpdir(), `diva-test-orders-webhook-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("ORDER_STORAGE_FILE", TEST_FILE);
  vi.stubEnv("SQLITE_FILE", ":memory:");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  constructEvent.mockReset();
  notifyOrderPaidMock.mockReset();
  enqueuePrintJobMock.mockReset();
  dispatchPaymentConfirmedMock.mockReset();
  onWebOrderPaidMock.mockReset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  const { closeDb } = await import("@/lib/db");
  closeDb();
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

function makeOrder(
  id: string,
  piId: string,
  paymentStatus: Order["paymentStatus"] = "pending",
  source: Order["source"] = "web",
): Order {
  return {
    id,
    source,
    locale: "en",
    lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name: "T", phone: "5555555555" },
      address: { street1: "1", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2099-01-01", slot: "midday" },
    },
    contact: { email: "t@example.com", phone: "5555555555" },
    totals: { subtotalCents: 1000, deliveryCents: 1000, discountCents: 0, taxCents: 173, totalCents: 2173 },
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
    expect(o?.paymentStatus).toBe("paid");
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

  it("runs the paid-web-order hook once on payment_intent.succeeded", async () => {
    await saveOrder(makeOrder("o_hook", "pi_hook"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_hook" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);
    expect(onWebOrderPaidMock).toHaveBeenCalledTimes(1);
    expect(onWebOrderPaidMock).toHaveBeenCalledWith("o_hook");
  });

  it("does not run the hook again for an order that was already paid", async () => {
    await saveOrder(makeOrder("o_twice", "pi_twice", "paid"));
    constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_twice" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    expect(onWebOrderPaidMock).not.toHaveBeenCalled();
  });
});

describe("checkout.session.completed", () => {
  it("marks a web order paid and routes it through the consent-aware web hook", async () => {
    // source: "web" (the makeOrder default) — this is the admin payment-link/resend
    // path for a web order that has no CRM customer yet. It must go through
    // onWebOrderPaid so messagingChannel reflects checkout consent, not the
    // dispatchPaymentConfirmed default of "sms".
    await saveOrder(makeOrder("o2", "pi_222"));
    await updateOrderCheckoutSessionId("o2", "cs_test");

    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          metadata: { orderId: "o2" },
          client_reference_id: "o2",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);

    const o = await getOrder("o2");
    expect(o?.paymentStatus).toBe("paid");
    expect(onWebOrderPaidMock).toHaveBeenCalledTimes(1);
    expect(onWebOrderPaidMock).toHaveBeenCalledWith("o2");
    expect(dispatchPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("dispatches payment_confirmed directly for a non-web (intake) order", async () => {
    // Intake orders already have a CRM customer + chosen channel from intake time;
    // onWebOrderPaid would early-return on the existing customerId link and drop
    // the confirmation, so these must go straight to dispatchPaymentConfirmed.
    await saveOrder(makeOrder("o4", "pi_444", "pending", "walk-in"));
    await updateOrderCheckoutSessionId("o4", "cs_test3");

    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test3",
          metadata: { orderId: "o4" },
          client_reference_id: "o4",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(200);

    const o = await getOrder("o4");
    expect(o?.paymentStatus).toBe("paid");
    expect(dispatchPaymentConfirmedMock).toHaveBeenCalledTimes(1);
    expect(dispatchPaymentConfirmedMock.mock.calls[0][0].paymentStatus).toBe("paid");
    expect(onWebOrderPaidMock).not.toHaveBeenCalled();
  });

  it("is idempotent on re-delivery", async () => {
    await saveOrder(makeOrder("o3", "pi_333"));
    await updateOrderCheckoutSessionId("o3", "cs_test2");

    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test2",
          metadata: { orderId: "o3" },
          client_reference_id: "o3",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    await POST(makeReq("{}"));
    await POST(makeReq("{}"));

    const o = await getOrder("o3");
    expect(o?.paymentStatus).toBe("paid");
    // Second delivery is a no-op: order already paid, so the hook is skipped.
    expect(onWebOrderPaidMock).toHaveBeenCalledTimes(1);
  });
});
