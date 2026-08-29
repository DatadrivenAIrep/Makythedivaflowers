import { describe, it, expect, beforeEach, vi } from "vitest";

const sendMessageMock = vi.fn();
vi.mock("@/lib/messaging", () => ({ sendMessage: (...a: unknown[]) => sendMessageMock(...a) }));
const getByPhoneMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({ getByPhone: (...a: unknown[]) => getByPhoneMock(...a) }));
const hasRecentSuccessMock = vi.fn();
vi.mock("@/lib/message-storage", () => ({ hasRecentSuccess: (...a: unknown[]) => hasRecentSuccessMock(...a) }));

import { dispatchOutForDelivery, dispatchDelivered } from "@/lib/order-dispatch";
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
    contact: { email: "a@x.com", phone: "5165550100" },
    totals: { subtotalCents: 5000, deliveryCents: 0, taxCents: 431, totalCents: 5431 },
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
});

describe("dispatchOutForDelivery", () => {
  it("sends out_for_delivery for a consented delivery order", async () => {
    await dispatchOutForDelivery(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ template: "out_for_delivery" }));
  });
  it("skips a pickup order", async () => {
    await dispatchOutForDelivery(order("pickup"));
    expect(sendMessageMock).not.toHaveBeenCalled();
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

describe("dispatchDelivered", () => {
  it("sends delivered for a consented delivery order", async () => {
    await dispatchDelivered(order("delivery"));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({ template: "delivered" }));
  });
  it("skips a pickup order", async () => {
    await dispatchDelivered(order("pickup"));
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
