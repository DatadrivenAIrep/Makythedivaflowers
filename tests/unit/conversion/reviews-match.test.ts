// tests/unit/conversion/reviews-match.test.ts
import { describe, it, expect } from "vitest";
import { matchReviews } from "@/lib/conversion/reviews-match";
import { REVIEWS, REVIEWS_AGGREGATE } from "@/data/reviews";
import type { Occasion } from "@/types/product";

describe("matchReviews", () => {
  it("matches anniversary product against Boda reviews", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary" as Occasion]);
    expect(result.matchedCount).toBeGreaterThanOrEqual(2);
    expect(result.usedFallback).toBe(false);
    expect(result.occasionLabelKey).toBe("anniversary");
    expect(result.matched.length).toBe(2);
  });

  it("matches birthday product against Cumpleaños reviews", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["birthday" as Occasion]);
    expect(result.matchedCount).toBeGreaterThanOrEqual(1);
    expect(result.occasionLabelKey).toBe("birthday");
  });

  it("falls back to top-rated reviews when no match exists for sympathy", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["sympathy" as Occasion]);
    expect(result.usedFallback).toBe(true);
    expect(result.occasionLabelKey).toBeNull();
    expect(result.matched.length).toBe(2);
  });

  it("returns the global aggregate counts regardless of match", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary" as Occasion]);
    expect(result.aggregateRating).toBe(REVIEWS_AGGREGATE.rating);
    expect(result.aggregateCount).toBe(REVIEWS_AGGREGATE.total);
  });

  it("uses the first occasion when product has multiple", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary", "romance"] as Occasion[]);
    expect(result.occasionLabelKey).toBe("anniversary");
  });
});
