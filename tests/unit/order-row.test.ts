import { describe, it, expect } from "vitest";
import { orderToRow, rowToOrder } from "@/lib/order-row";
import type { Order } from "@/types/order";

const sample: Order = {
  id: "do_abc",
  source: "web",
  locale: "en",
  lines: [
    { kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 },
    { kind: "custom", title: "Roses white", priceCents: 8000, designerNotes: "tall vase", qty: 1 },
  ],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550100" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "Hi",
  },
  contact: { email: "a@b.com", phone: "5165550100" },
  totals: { subtotalCents: 17400, deliveryCents: 1500, taxCents: 1651, totalCents: 20551 },
  status: "pending",
  paymentStatus: "pending",
  amountPaidCents: 0,
  createdAt: "2026-05-16T00:00:00.000Z",
  updatedAt: "2026-05-16T00:00:00.000Z",
};

describe("order-row", () => {
  it("round-trips an order through orderToRow and rowToOrder", () => {
    const row = orderToRow(sample);
    const back = rowToOrder(row);
    expect(back).toEqual(sample);
  });

  it("round-trips stripeCheckoutSessionId", () => {
    const o: Order = { ...sample, stripeCheckoutSessionId: "cs_123" };
    const row = orderToRow(o);
    expect(row.stripe_checkout_session_id).toBe("cs_123");
    const back = rowToOrder(row);
    expect(back.stripeCheckoutSessionId).toBe("cs_123");
  });

  it("serializes in-store fulfillment without address or window", () => {
    const inStore: Order = {
      ...sample,
      fulfillment: {
        method: "in-store",
        recipient: { name: "Walk-in", phone: "5165550100" },
      },
    };
    const row = orderToRow(inStore);
    expect(row.fulfillment_method).toBe("in-store");
    expect(row.address_json).toBeNull();
    expect(row.window_date).toBeNull();
    const back = rowToOrder(row);
    expect(back.fulfillment.method).toBe("in-store");
  });
});
