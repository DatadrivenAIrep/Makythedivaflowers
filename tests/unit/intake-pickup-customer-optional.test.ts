import { describe, it, expect } from "vitest";
import { intakeSchema } from "@/schemas/intake";

const lines = [{ kind: "custom" as const, title: "Ramo", priceCents: 5000, qty: 1 }];
const payment = { status: "pending" as const };
const recipient = { name: "Ana", phone: "5165550100" };
const win = { date: "2026-07-04", slot: "midday" as const };

describe("intake: buyer optional for pickup", () => {
  it("accepts pickup with an empty customer (no name/phone)", () => {
    const r = intakeSchema.safeParse({
      source: "walk-in", customer: {},
      fulfillment: { method: "pickup", recipient, window: win },
      lines, payment,
    });
    expect(r.success).toBe(true);
  });

  it("rejects delivery without customer name/phone", () => {
    const r = intakeSchema.safeParse({
      source: "walk-in", customer: {},
      fulfillment: { method: "delivery", recipient, address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" }, window: win },
      lines, payment,
    });
    expect(r.success).toBe(false);
  });

  it("still requires customer for in-store", () => {
    const r = intakeSchema.safeParse({
      source: "walk-in", customer: {},
      fulfillment: { method: "in-store", recipient },
      lines, payment,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a delivery when the customer IS provided", () => {
    const r = intakeSchema.safeParse({
      source: "walk-in", customer: { name: "Juan", phone: "5165550199" },
      fulfillment: { method: "delivery", recipient, address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" }, window: win },
      lines, payment,
    });
    expect(r.success).toBe(true);
  });
});
