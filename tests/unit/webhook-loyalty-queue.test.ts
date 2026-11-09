import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Order } from "@/types/order";

const { notifyOrderPaid, onWebOrderPaid, readOverride } = vi.hoisted(() => ({
  notifyOrderPaid: vi.fn(),
  onWebOrderPaid: vi.fn(),
  readOverride: { fail: false },
}));

vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid }));
vi.mock("@/lib/on-web-order-paid", () => ({ onWebOrderPaid }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchPaymentConfirmed: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe-server", () => ({
  stripe: { webhooks: { constructEvent: (raw: string) => JSON.parse(raw) } },
}));
vi.mock("@/lib/order-storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/order-storage")>();
  return {
    ...actual,
    getOrder: async (id: string) => {
      if (readOverride.fail) throw Object.assign(new Error("db gone 5165550100"), { code: "SQLITE_BUSY" });
      return actual.getOrder(id);
    },
  };
});

import { saveOrder, getOrder, updateOrderCheckoutSessionId } from "@/lib/order-storage";
import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/diva-wh-loyalty-${process.pid}.json`);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  runMigrations();
  readOverride.fail = false;
  notifyOrderPaid.mockReset().mockResolvedValue(undefined);
  onWebOrderPaid.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeOrder(id: string, over: Partial<Order> = {}): Order {
  return {
    id,
    orderNumber: 1042,
    source: "web",
    locale: "en",
    lines: [],
    fulfillment: { method: "pickup", recipient: { name: "T", phone: "5165550100" }, window: { date: "2099-01-01", slot: "midday" } },
    contact: { name: "Bob", email: "t@example.com", phone: "5165550100" },
    totals: { subtotalCents: 1000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 1000 },
    stripePaymentIntentId: `pi_${id}`,
    status: "pending",
    paymentStatus: "pending",
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    ...over,
  };
}

function fire(type: string, object: unknown) {
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: JSON.stringify({ type, data: { object } }),
    }),
  );
}

function rows(orderId: string) {
  return getDb().prepare("SELECT status FROM loyalty_sync WHERE order_id = ? AND kind = 'sync'").all(orderId) as {
    status: string;
  }[];
}

describe("payment_intent.succeeded queues the stamp right after the paid write", () => {
  const event = (id: string) => ["payment_intent.succeeded", { id: `pi_${id}` }] as const;

  it("a throw after the paid write, then a Stripe retry, leaves one pending row", async () => {
    await saveOrder(makeOrder("o1"));
    notifyOrderPaid.mockRejectedValueOnce(new Error("resend down"));

    expect((await fire(...event("o1"))).status).toBe(500);
    expect((await getOrder("o1"))?.paymentStatus).toBe("paid");
    expect(onWebOrderPaid).not.toHaveBeenCalled();
    expect(rows("o1")).toEqual([{ status: "pending" }]);

    expect((await fire(...event("o1"))).status).toBe(200);
    expect(rows("o1")).toEqual([{ status: "pending" }]);
  });

  it("queues an order that was already paid when the event arrives", async () => {
    await saveOrder(makeOrder("o2", { paymentStatus: "paid" }));
    expect((await fire(...event("o2"))).status).toBe(200);
    expect(rows("o2")).toEqual([{ status: "pending" }]);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("queues nothing for an order canceled before the payment landed", async () => {
    await saveOrder(makeOrder("o3", { status: "canceled" }));
    await fire(...event("o3"));
    expect(rows("o3")).toEqual([]);
  });

  it("queues nothing when the connection is off", async () => {
    vi.stubEnv("LOYALTY_API_KEY", "");
    await saveOrder(makeOrder("o4"));
    expect((await fire(...event("o4"))).status).toBe(200);
    expect(rows("o4")).toEqual([]);
  });

  it("a failing read cannot fail the webhook and logs only name, code and status", async () => {
    await saveOrder(makeOrder("o5", { paymentStatus: "paid" }));
    readOverride.fail = true;
    expect((await fire(...event("o5"))).status).toBe(200);
    const call = vi.mocked(console.error).mock.calls.find((c) => String(c[0]).includes("[loyalty]"));
    expect(call?.[1]).toEqual({ name: "Error", code: "SQLITE_BUSY", status: undefined });
    expect(JSON.stringify(call)).not.toContain("5165550100");
  });
});

describe("checkout.session.completed queues the stamp right after the paid write", () => {
  async function seed(id: string, over: Partial<Order> = {}) {
    await saveOrder(makeOrder(id, over));
    await updateOrderCheckoutSessionId(id, `cs_${id}`);
  }
  const event = (id: string) =>
    ["checkout.session.completed", { id: `cs_${id}`, metadata: { orderId: id } }] as const;

  it("a throw after the paid write, then a Stripe retry, leaves one pending row", async () => {
    await seed("c1");
    onWebOrderPaid.mockRejectedValueOnce(new Error("boom"));

    expect((await fire(...event("c1"))).status).toBe(500);
    expect((await getOrder("c1"))?.paymentStatus).toBe("paid");
    expect(rows("c1")).toEqual([{ status: "pending" }]);

    expect((await fire(...event("c1"))).status).toBe(200);
    expect(rows("c1")).toEqual([{ status: "pending" }]);
  });

  it("queues an order that was already paid when the event arrives", async () => {
    await seed("c2", { paymentStatus: "paid" });
    expect((await fire(...event("c2"))).status).toBe(200);
    expect(rows("c2")).toEqual([{ status: "pending" }]);
    expect(onWebOrderPaid).not.toHaveBeenCalled();
  });

  it("queues nothing for an intake order", async () => {
    await seed("c3", { source: "walk-in" });
    expect((await fire(...event("c3"))).status).toBe(200);
    expect(rows("c3")).toEqual([]);
  });
});
