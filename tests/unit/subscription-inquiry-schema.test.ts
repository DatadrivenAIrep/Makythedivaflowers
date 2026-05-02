import { describe, it, expect } from "vitest";
import { subscriptionInquirySchema } from "@/schemas/subscription-inquiry";

function tomorrow(plus = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + plus);
  return d.toISOString().slice(0, 10);
}

const baseSubscription = {
  type: "subscription" as const,
  locale: "en" as const,
  plan: "maison" as const,
  cadence: "weekly" as const,
  startDate: tomorrow(3),
  recipient: { name: "Lola Cardona", phone: "5165550101" },
  address: {
    street1: "1 Park Ave",
    street2: "",
    city: "New York",
    state: "NY",
    zip: "10010",
    country: "US" as const,
  },
  window: { slot: "midday" as const },
  contact: { email: "lola@example.com", phone: "5165550101" },
  cardMessageMode: "fixed" as const,
  cardMessage: "",
  notes: "",
  honeypot: "",
};

describe("subscriptionInquirySchema", () => {
  it("accepts a valid payload", () => {
    expect(subscriptionInquirySchema.safeParse(baseSubscription).success).toBe(true);
  });

  it("rejects bot-filled honeypot", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, honeypot: "spam" }).success,
    ).toBe(false);
  });

  it("rejects unknown plan", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, plan: "platinum" }).success,
    ).toBe(false);
  });

  it("rejects unknown cadence", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, cadence: "monthly" }).success,
    ).toBe(false);
  });

  it("rejects start date earlier than today + 2 days", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, startDate: tomorrow(1) }).success,
    ).toBe(false);
  });

  it("rejects malformed startDate", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, startDate: "soon" }).success,
    ).toBe(false);
  });

  it("rejects card message longer than 500 chars", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, cardMessage: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects notes longer than 1000 chars", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, notes: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("requires recipient name", () => {
    expect(
      subscriptionInquirySchema.safeParse({ ...baseSubscription, recipient: { name: "", phone: "5165550101" } }).success,
    ).toBe(false);
  });

  it("accepts rotation mode with occasion and relation", () => {
    expect(
      subscriptionInquirySchema.safeParse({
        ...baseSubscription,
        cardMessageMode: "rotation",
        cardMessage: "",
        cardOccasion: "romance",
        cardRelation: "partner",
      }).success,
    ).toBe(true);
  });

  it("rejects rotation mode without occasion or relation", () => {
    expect(
      subscriptionInquirySchema.safeParse({
        ...baseSubscription,
        cardMessageMode: "rotation",
        cardMessage: "",
      }).success,
    ).toBe(false);
  });

  it("accepts fixed mode without occasion/relation", () => {
    expect(
      subscriptionInquirySchema.safeParse({
        ...baseSubscription,
        cardMessageMode: "fixed",
        cardMessage: "Thinking of you, every week.",
      }).success,
    ).toBe(true);
  });
});
