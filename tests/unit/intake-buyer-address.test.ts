import { describe, it, expect } from "vitest";
import { intakeSchema } from "@/schemas/intake";

const base = {
  source: "walk-in" as const,
  customer: { phone: "5165550100", name: "Juan" },
  fulfillment: { method: "in-store" as const, recipient: { name: "Maria", phone: "5165550100" } },
  lines: [{ kind: "custom" as const, title: "Ramo", priceCents: 5000, qty: 1 }],
  payment: { status: "pending" as const },
};

describe("intake schema buyerAddress", () => {
  it("accepts a customer with a buyer address", () => {
    const r = intakeSchema.safeParse({
      ...base,
      customer: { ...base.customer, buyerAddress: { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" } },
    });
    expect(r.success).toBe(true);
  });
  it("accepts a customer without a buyer address (optional)", () => {
    expect(intakeSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a malformed buyer address", () => {
    const r = intakeSchema.safeParse({
      ...base,
      customer: { ...base.customer, buyerAddress: { street1: "x", city: "A", state: "NEW YORK", zip: "bad", country: "US" } },
    });
    expect(r.success).toBe(false);
  });
});
