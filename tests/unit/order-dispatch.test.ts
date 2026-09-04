import { describe, it, expect, beforeEach, vi } from "vitest";

const sendMessageMock = vi.fn();
vi.mock("@/lib/messaging", () => ({ sendMessage: (...a: unknown[]) => sendMessageMock(...a) }));
const getByPhoneMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({ getByPhone: (...a: unknown[]) => getByPhoneMock(...a) }));
const hasRecentSuccessMock = vi.fn();
vi.mock("@/lib/message-storage", () => ({ hasRecentSuccess: (...a: unknown[]) => hasRecentSuccessMock(...a) }));
const getSettingMock = vi.fn();
vi.mock("@/lib/settings-storage", () => ({
  getSetting: (...a: unknown[]) => getSettingMock(...a),
  SETTING_GOOGLE_REVIEW_URL: "google_review_url",
}));

import { dispatchOutForDelivery, dispatchDelivered, dispatchReviewRequest, dispatchOrderReceived } from "@/lib/order-dispatch";
import type { Order } from "@/types/order";

function order(method: "delivery" | "pickup"): Order {
  const fulfillment =
    method === "delivery"
      ? {
          method: "delivery" as const,
          recipient: { name: "Ana Ruiz", phone: "5165550100" },
          address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" as const },
          window: { date: "2099-07-01", slot: "morning" as const },
        }
      : {
          method: "pickup" as const,
          recipient: { name: "Ana Ruiz", phone: "5165550100" },
          window: { date: "2099-07-01", slot: "morning" as const },
        };
  return {
    id: "do_1",
    source: "web",
    locale: "es",
    lines: [{ kind: "catalog", productId: "p1", variantId: "v1", addOnIds: [], qty: 1 }],
    fulfillment,
    contact: { name: "Bob Buyer", email: "a@x.com", phone: "5165550100" },
    totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 431, totalCents: 5431 },
    status: "out-for-delivery",
    paymentStatus: "paid",
    createdAt: "2026-08-18T00:00:00Z",
    updatedAt: "2026-08-18T00:00:00Z",
  };
}

beforeEach(() => {
  sendMessageMock.mockReset().mockResolvedValue({ id: "m1", status: "sent" });
  getByPhoneMock.mockReset().mockReturnValue({ id: "cus_1", messagingChannel: "sms" });
  hasRecentSuccessMock.mockReset().mockReturnValue(false);
  getSettingMock.mockReset().mockReturnValue("https://g.page/r/test/review");
});

describe("dispatchOutForDelivery", () => {
  it("sends out_for_delivery for a consented delivery order, greeting the BUYER", async () => {
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "out_for_delivery",
        vars: expect.objectContaining({ buyer_name: "Bob" }),
      }),
    );
  });
  it("sends ready_for_pickup for a pickup order (not on the way)", async () => {
    await dispatchOutForDelivery(order("pickup"));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "ready_for_pickup" }),
    );
  });
  it("skips when the buyer opted out (channel none)", async () => {
    getByPhoneMock.mockReturnValue({ id: "cus_1", messagingChannel: "none" });
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("dedupes within 24h", async () => {
    hasRecentSuccessMock.mockReturnValue(true);
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

describe("dispatchOrderReceived fulfillment label", () => {
  it("labels a pickup order 'Recoger' (es), not 'Entrega'", async () => {
    await dispatchOrderReceived(order("pickup"));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "order_received",
        vars: expect.objectContaining({ fulfillment_label: "Recoger" }),
      }),
    );
  });
  it("labels a delivery order 'Entrega' (es)", async () => {
    await dispatchOrderReceived(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vars: expect.objectContaining({ fulfillment_label: "Entrega" }),
      }),
    );
  });
});

describe("dispatchDelivered", () => {
  it("sends delivered for a consented delivery order", async () => {
    await dispatchDelivered(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ template: "delivered" }));
  });
  it("skips a pickup order (no auto SMS on pickup collection)", async () => {
    await dispatchDelivered(order("pickup"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

function delivered(method: "delivery" | "pickup"): Order {
  return { ...order(method), status: "delivered" };
}

describe("dispatchReviewRequest", () => {
  it("sends review_request with the configured link and returns ok", async () => {
    const res = await dispatchReviewRequest(delivered("delivery"));
    expect(res).toEqual({ ok: true });
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "review_request",
        vars: expect.objectContaining({ link: "https://g.page/r/test/review", buyer_name: "Bob" }),
      }),
    );
  });
  it("refuses an order that isn't delivered yet", async () => {
    const res = await dispatchReviewRequest(order("delivery")); // status out-for-delivery
    expect(res).toEqual({ ok: false, reason: "not_delivered" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("skips when no review URL is configured", async () => {
    getSettingMock.mockReturnValue(undefined);
    const res = await dispatchReviewRequest(delivered("delivery"));
    expect(res).toEqual({ ok: false, reason: "no_review_url" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("skips when the buyer opted out", async () => {
    getByPhoneMock.mockReturnValue({ id: "cus_1", messagingChannel: "none" });
    const res = await dispatchReviewRequest(delivered("delivery"));
    expect(res).toEqual({ ok: false, reason: "opted_out" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("dedupes a repeat request", async () => {
    hasRecentSuccessMock.mockReturnValue(true);
    const res = await dispatchReviewRequest(delivered("delivery"));
    expect(res).toEqual({ ok: false, reason: "already_sent" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
  it("works for a picked-up (pickup) order too", async () => {
    const res = await dispatchReviewRequest(delivered("pickup"));
    expect(res).toEqual({ ok: true });
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ template: "review_request" }),
    );
  });
});
