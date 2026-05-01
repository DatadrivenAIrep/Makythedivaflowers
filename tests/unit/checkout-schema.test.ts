// tests/unit/checkout-schema.test.ts
import { describe, it, expect } from "vitest";
import { checkoutSchema } from "@/schemas/checkout";

const valid = {
  contact: { email: "lola@example.com", phone: "5164843456" },
  delivery: {
    recipient: { name: "Lola Cardona", phone: "5165550101" },
    address: { street1: "1077 Hempstead Tpke", city: "Franklin Square", state: "NY", zip: "11010", country: "US" as const },
    window: { date: "2026-05-15", slot: "midday" as const },
    cardMessage: "Happy birthday",
  },
};

describe("checkoutSchema", () => {
  it("accepts a valid payload", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects bad email", () => {
    const bad = { ...valid, contact: { ...valid.contact, email: "nope" } };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects phone shorter than 10 digits", () => {
    const bad = { ...valid, contact: { ...valid.contact, phone: "123" } };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects 5-digit zip with letters", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, address: { ...valid.delivery.address, zip: "ABCDE" } },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("caps cardMessage at 200 chars", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, cardMessage: "x".repeat(201) },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects past delivery dates", () => {
    const bad = {
      ...valid,
      delivery: { ...valid.delivery, window: { date: "2020-01-01", slot: "midday" as const } },
    };
    expect(checkoutSchema.safeParse(bad).success).toBe(false);
  });
});
