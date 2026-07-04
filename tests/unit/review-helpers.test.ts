// tests/unit/review-helpers.test.ts
import { describe, it, expect } from "vitest";
import { reviewsByOccasion, generalReviews } from "@/data/review-helpers";

describe("reviewsByOccasion", () => {
  it("returns only reviews whose occasion matches", () => {
    const boda = reviewsByOccasion("Boda");
    expect(boda.length).toBeGreaterThanOrEqual(2);
    expect(boda.every((r) => r.occasion === "Boda")).toBe(true);
    expect(boda.map((r) => r.id)).toContain("blanca-duarte-martini-2025-12");
    expect(boda.map((r) => r.id)).toContain("samantha-brown-2026-03");
  });

  it("returns an empty array for an unused occasion", () => {
    expect(reviewsByOccasion("NoSuchOccasion")).toEqual([]);
  });
});

describe("generalReviews", () => {
  it("returns only reviews without an occasion", () => {
    const general = generalReviews();
    expect(general.length).toBeGreaterThanOrEqual(1);
    expect(general.every((r) => !r.occasion)).toBe(true);
  });
});
