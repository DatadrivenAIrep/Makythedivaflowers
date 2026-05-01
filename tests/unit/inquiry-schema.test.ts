// tests/unit/inquiry-schema.test.ts
import { describe, it, expect } from "vitest";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { contactSchema } from "@/schemas/contact";
import { newsletterSchema } from "@/schemas/newsletter";

const baseWedding = {
  type: "wedding" as const,
  contact: { name: "Lola Cardona", email: "lola@example.com", phone: "5165550101" },
  date: "2026-09-12",
  venue: "Glen Cove Mansion",
  guests: 120,
  budgetBand: "10-25k" as const,
  vibe: "Romantic, white + soft pink, candles everywhere.",
  source: "instagram",
  locale: "en" as const,
  honeypot: "",
};

const baseEvent = {
  type: "event" as const,
  contact: { name: "Acme Co", email: "ops@acme.com", phone: "2125550100" },
  company: "Acme Co",
  frequency: "monthly" as const,
  guests: 30,
  budgetBand: "5-10k" as const,
  vibe: "Reception desk + monthly office refresh.",
  locale: "en" as const,
  honeypot: "",
};

describe("weddingInquirySchema", () => {
  it("accepts valid", () => {
    expect(weddingInquirySchema.safeParse(baseWedding).success).toBe(true);
  });
  it("rejects bot-filled honeypot", () => {
    expect(weddingInquirySchema.safeParse({ ...baseWedding, honeypot: "spam" }).success).toBe(false);
  });
  it("rejects vibe shorter than 10 chars", () => {
    expect(weddingInquirySchema.safeParse({ ...baseWedding, vibe: "ok" }).success).toBe(false);
  });
});

describe("eventInquirySchema", () => {
  it("accepts valid", () => {
    expect(eventInquirySchema.safeParse(baseEvent).success).toBe(true);
  });
});

describe("contactSchema", () => {
  it("accepts valid", () => {
    expect(contactSchema.safeParse({
      name: "Lola", email: "lola@x.com", subject: "Hello", body: "I'd love to chat about a wedding installation.", locale: "en", honeypot: "",
    }).success).toBe(true);
  });
});

describe("newsletterSchema", () => {
  it("accepts valid", () => {
    expect(newsletterSchema.safeParse({ email: "x@y.com", locale: "en", honeypot: "" }).success).toBe(true);
  });
});
