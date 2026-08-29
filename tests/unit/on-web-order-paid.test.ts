import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "@/types/order";

const upsertOnOrderMock = vi.fn();
const addTagMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({
  upsertOnOrder: (...args: unknown[]) => upsertOnOrderMock(...args),
  addTag: (...args: unknown[]) => addTagMock(...args),
}));

const getOrderMock = vi.fn();
const updateOrderMock = vi.fn();
vi.mock("@/lib/order-storage", () => ({
  getOrder: (...args: unknown[]) => getOrderMock(...args),
  updateOrder: (...args: unknown[]) => updateOrderMock(...args),
}));

const dispatchPaymentConfirmedMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchPaymentConfirmed: (...args: unknown[]) => dispatchPaymentConfirmedMock(...args),
}));

import { onWebOrderPaid } from "@/lib/on-web-order-paid";

const ORDER: Order = {
  id: "do_1",
  orderNumber: 1042,
  source: "web",
  locale: "en",
  lines: [],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Ana Recipient", phone: "5165550111" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-08-21", slot: "morning" },
  },
  contact: { name: "Bob Buyer", email: "bob@example.com", phone: "5165550100" },
  totals: { subtotalCents: 8000, deliveryCents: 0, taxCents: 690, totalCents: 8690 },
  status: "pending",
  paymentStatus: "paid",
  paidAt: "2026-08-17T15:00:00Z",
  createdAt: "2026-08-17T14:00:00Z",
  updatedAt: "2026-08-17T15:00:00Z",
};

beforeEach(() => {
  upsertOnOrderMock.mockReset().mockReturnValue({ id: "cus_1" });
  addTagMock.mockReset();
  getOrderMock.mockReset().mockResolvedValue(ORDER);
  updateOrderMock.mockReset().mockResolvedValue(undefined);
  dispatchPaymentConfirmedMock.mockReset().mockResolvedValue(undefined);
});

describe("onWebOrderPaid", () => {
  it("creates the customer and links it before dispatching the SMS", async () => {
    const calls: string[] = [];
    upsertOnOrderMock.mockImplementation(() => { calls.push("upsert"); return { id: "cus_1" }; });
    updateOrderMock.mockImplementation(async () => { calls.push("update"); });
    dispatchPaymentConfirmedMock.mockImplementation(async () => { calls.push("dispatch"); });

    await onWebOrderPaid("do_1");

    // Order is load-bearing: dispatchPaymentConfirmed looks the customer up by
    // phone to honour their channel and locale, so the upsert must land first.
    expect(calls).toEqual(["upsert", "update", "dispatch"]);
  });

  it("maps the buyer, not the recipient, onto the customer record", async () => {
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bob Buyer",
        phone: "5165550100",
        email: "bob@example.com",
        locale: "en",
        orderAt: "2026-08-17T15:00:00Z",
      }),
    );
  });

  it("falls back to the recipient name when the buyer left theirs blank", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, contact: { ...ORDER.contact, name: "  " } });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Recipient" }),
    );
  });

  it("passes email as undefined when the buyer left it blank", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, contact: { ...ORDER.contact, email: "" } });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
    );
  });

  it("writes the customer id back onto the order", async () => {
    await onWebOrderPaid("do_1");
    expect(updateOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "do_1", customerId: "cus_1" }),
    );
  });

  it("does nothing when the order already has a customer", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, customerId: "cus_existing" });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).not.toHaveBeenCalled();
    expect(dispatchPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("does nothing when the order is gone", async () => {
    getOrderMock.mockResolvedValue(null);
    await expect(onWebOrderPaid("missing")).resolves.toBeUndefined();
    expect(upsertOnOrderMock).not.toHaveBeenCalled();
  });

  it("swallows a messaging failure so the webhook still returns 200", async () => {
    dispatchPaymentConfirmedMock.mockRejectedValue(new Error("twilio exploded"));
    await expect(onWebOrderPaid("do_1")).resolves.toBeUndefined();
    expect(updateOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "do_1", customerId: "cus_1" }),
    );
  });

  it("swallows a CRM failure too", async () => {
    upsertOnOrderMock.mockImplementation(() => { throw new Error("db locked"); });
    await expect(onWebOrderPaid("do_1")).resolves.toBeUndefined();
    expect(dispatchPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("opts the customer into SMS when the order has consent", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsConsent: true });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messagingChannel: "sms" }),
    );
  });

  it("sets channel to none when the order has no consent", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsConsent: false });
    await onWebOrderPaid("do_1");
    expect(upsertOnOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messagingChannel: "none" }),
    );
  });

  it("tags the customer sms-marketing when marketing consent is given", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsMarketingConsent: true });
    await onWebOrderPaid("do_1");
    expect(addTagMock).toHaveBeenCalledWith("cus_1", "sms-marketing");
  });

  it("does not tag sms-marketing without marketing consent", async () => {
    getOrderMock.mockResolvedValue({ ...ORDER, smsMarketingConsent: false });
    await onWebOrderPaid("do_1");
    expect(addTagMock).not.toHaveBeenCalled();
  });
});
