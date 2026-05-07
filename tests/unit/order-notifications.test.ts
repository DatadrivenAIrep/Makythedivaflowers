import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { __buildBody as buildBody } from "@/lib/order-notifications";

const baseOrder: Order = {
  id: "do_test",
  locale: "en",
  lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "paid",
  createdAt: "2026-05-07T15:30:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    window: { date: "2026-05-15", slot: "midday" },
    cardMessage: "Happy birthday",
  },
};

describe("order-notifications buildBody", () => {
  it("renders PICK UP AT SHOP section for pickup orders", () => {
    const body = buildBody(baseOrder);
    expect(body).toContain("PICK UP AT SHOP");
    expect(body).toContain("1077 Willis Ave");
    expect(body).not.toContain("DELIVER TO");
  });

  it("renders DELIVER TO section for delivery orders", () => {
    const order: Order = {
      ...baseOrder,
      delivery: {
        method: "delivery",
        recipient: { name: "Lola Cardona", phone: "5165550101" },
        address: {
          street1: "1 Test St",
          city: "Albertson",
          state: "NY",
          zip: "11507",
          country: "US",
        },
        window: { date: "2026-05-15", slot: "midday" },
        cardMessage: "Happy birthday",
      },
    };
    const body = buildBody(order);
    expect(body).toContain("DELIVER TO");
    expect(body).toContain("1 Test St");
    expect(body).not.toContain("PICK UP AT SHOP");
  });
});
