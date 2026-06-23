import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { __buildBody as buildBody } from "@/lib/order-notifications";

const order: Order = {
  id: "do_1", source: "web", locale: "en",
  lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "pending", paymentStatus: "paid",
  giftCardId: "gc_1", giftCardCents: 15000,
  createdAt: "2026-06-22T00:00:00Z", updatedAt: "2026-06-22T00:00:00Z",
  fulfillment: { method: "pickup", recipient: { name: "Lola", phone: "5165550101" }, window: { date: "2026-07-01", slot: "midday" } },
};

describe("order confirmation with gift card", () => {
  it("shows the gift card amount applied", () => {
    const body = buildBody(order);
    expect(body).toMatch(/gift card/i);
    expect(body).toContain("$150.00");
  });
});
