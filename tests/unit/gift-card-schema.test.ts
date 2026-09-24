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
  it("accepts other whole-dollar amounts inside the band", () => {
    for (const amountCents of [500, 2500, 3500, 10000, 50000, 100000]) {
      expect(issueGiftCardSchema.safeParse({ ...valid, amountCents }).success).toBe(true);
    }
  });
  it("rejects amounts outside the band or with cents", () => {
    for (const amountCents of [0, 499, 100100, 7550]) {
      expect(issueGiftCardSchema.safeParse({ ...valid, amountCents }).success).toBe(false);
    }
  });
  it("allows optional fields to be omitted", () => {
    expect(
      issueGiftCardSchema.safeParse({ amountCents: 15000, recipientEmail: "a@b.com" }).success,
    ).toBe(true);
  });
});
