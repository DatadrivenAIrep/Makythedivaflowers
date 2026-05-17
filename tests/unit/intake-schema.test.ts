import { describe, it, expect } from "vitest";
import { intakeSchema } from "@/schemas/intake";

const validDelivery = {
  source: "walk-in" as const,
  customer: { phone: "5165550100", name: "Maria" },
  fulfillment: {
    method: "delivery" as const,
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" as const },
    window: { date: "2099-01-01", slot: "midday" as const },
  },
  lines: [{ kind: "catalog" as const, productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  payment: { status: "paid" as const, method: "cash" as const },
};

describe("intakeSchema", () => {
  it("accepts a complete delivery walk-in", () => {
    const r = intakeSchema.safeParse(validDelivery);
    expect(r.success).toBe(true);
  });

  it("allows in-store fulfillment with no address or window", () => {
    const r = intakeSchema.safeParse({
      ...validDelivery,
      fulfillment: { method: "in-store", recipient: { name: "Maria", phone: "5165550100" } },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a custom line item", () => {
    const r = intakeSchema.safeParse({
      ...validDelivery,
      lines: [{ kind: "custom", title: "Roses", priceCents: 8000, qty: 1 }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts pending payment", () => {
    const r = intakeSchema.safeParse({ ...validDelivery, payment: { status: "pending" } });
    expect(r.success).toBe(true);
  });

  it("rejects empty lines", () => {
    const r = intakeSchema.safeParse({ ...validDelivery, lines: [] });
    expect(r.success).toBe(false);
  });

  it("accepts optional customer email omitted", () => {
    const { customer, ...rest } = validDelivery;
    const r = intakeSchema.safeParse({ ...rest, customer: { phone: customer.phone, name: customer.name } });
    expect(r.success).toBe(true);
  });
});
