import { describe, it, expect } from "vitest";
import { issueGiftCardSchema } from "@/schemas/gift-card";

const valid = {
  amountCents: 15000,
  recipientEmail: "maria@example.com",
  recipientName: "María",
  fromLabel: "Maky · Diva Flowers",
  personalMessage: "¡Gracias!",
  reason: "loyalty" as const,
};

describe("issueGiftCardSchema", () => {
  it("accepts a valid $150 issuance", () => {
    expect(issueGiftCardSchema.safeParse(valid).success).toBe(true);
  });
  it("requires a valid recipient email", () => {
    expect(issueGiftCardSchema.safeParse({ ...valid, recipientEmail: "nope" }).success).toBe(false);
  });
  it("rejects amounts other than 15000 in phase 1", () => {
    expect(issueGiftCardSchema.safeParse({ ...valid, amountCents: 10000 }).success).toBe(false);
  });
  it("allows optional fields to be omitted", () => {
    expect(
      issueGiftCardSchema.safeParse({ amountCents: 15000, recipientEmail: "a@b.com" }).success,
    ).toBe(true);
  });
});
