import { describe, it, expect } from "vitest";
import { isOrderPaid } from "@/lib/order-paid";

describe("isOrderPaid", () => {
  it("is true when paymentStatus is 'paid' even while fulfillment is still 'pending'", () => {
    // The core bug: Stripe marks paymentStatus='paid' but leaves fulfillment
    // status='pending'. The confirmation page must still treat this as paid.
    expect(isOrderPaid({ status: "pending", paymentStatus: "paid" })).toBe(true);
  });

  it("is false when both payment and fulfillment are pending", () => {
    expect(isOrderPaid({ status: "pending", paymentStatus: "pending" })).toBe(false);
  });

  it("is true for legacy orders where 'paid' was stored in the fulfillment status", () => {
    expect(isOrderPaid({ status: "paid" as never, paymentStatus: "pending" })).toBe(true);
  });

  it("is true once fulfillment has advanced (preserves prior behavior)", () => {
    expect(isOrderPaid({ status: "preparing", paymentStatus: "paid" })).toBe(true);
  });

  it("is false for a refunded order that never advanced fulfillment", () => {
    expect(isOrderPaid({ status: "pending", paymentStatus: "refunded" })).toBe(false);
  });
});
