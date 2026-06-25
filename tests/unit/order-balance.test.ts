import { describe, it, expect } from "vitest";
import { orderBalanceCents } from "@/lib/order-balance";
import type { Order } from "@/types/order";

function order(totalCents: number, amountPaidCents: number | undefined): Order {
  return {
    id: "x", source: "walk-in", locale: "es", lines: [],
    fulfillment: { method: "in-store", recipient: { name: "R", phone: "5" } },
    contact: { phone: "5" },
    totals: { subtotalCents: totalCents, deliveryCents: 0, taxCents: 0, totalCents },
    status: "pending", paymentStatus: "pending",
    amountPaidCents,
    createdAt: "", updatedAt: "",
  };
}

describe("orderBalanceCents", () => {
  it("is positive when the total exceeds what was paid (saldo pendiente)", () => {
    expect(orderBalanceCents(order(6000, 5000))).toBe(1000);
  });
  it("is negative when more was paid than the total (saldo a favor)", () => {
    expect(orderBalanceCents(order(4000, 5000))).toBe(-1000);
  });
  it("is zero when settled", () => {
    expect(orderBalanceCents(order(5000, 5000))).toBe(0);
  });
  it("treats a missing amountPaidCents as 0", () => {
    expect(orderBalanceCents(order(5000, undefined))).toBe(5000);
  });
});
