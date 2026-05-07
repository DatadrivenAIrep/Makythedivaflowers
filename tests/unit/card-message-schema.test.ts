import { describe, it, expect } from "vitest";
import { cardMessageRequestSchema, occasionSchema } from "@/schemas/card-message";

describe("cardMessageRequestSchema", () => {
  const valid = {
    productTitle: "Timeless Romance",
    occasion: "anniversary",
    relation: "partner",
    locale: "en",
  };

  it("accepts a valid request", () => {
    const r = cardMessageRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("accepts sympathy-mode relations", () => {
    for (const relation of ["family", "close-friend", "coworker", "other"]) {
      const r = cardMessageRequestSchema.safeParse({ ...valid, occasion: "sympathy", relation });
      expect(r.success).toBe(true);
    }
  });

  it("accepts default-mode relations", () => {
    for (const relation of ["partner", "mother", "father", "friend", "family", "other"]) {
      const r = cardMessageRequestSchema.safeParse({ ...valid, relation });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown occasion", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, occasion: "wedding" }).success).toBe(false);
  });

  it("rejects unknown locale", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });

  it("rejects unknown relation", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, relation: "boss" }).success).toBe(false);
  });

  it("rejects productTitle longer than 80 chars", () => {
    const long = "x".repeat(81);
    expect(cardMessageRequestSchema.safeParse({ ...valid, productTitle: long }).success).toBe(false);
  });

  it("rejects empty productTitle", () => {
    expect(cardMessageRequestSchema.safeParse({ ...valid, productTitle: "" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(cardMessageRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("occasionSchema", () => {
  it("accepts mothers-day", () => {
    expect(occasionSchema.safeParse("mothers-day").success).toBe(true);
  });
});
