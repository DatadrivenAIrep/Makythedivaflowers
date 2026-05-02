// lib/conversion/reviews-match.ts
import type { Review, ReviewsAggregate } from "@/data/reviews";
import type { Occasion } from "@/types/product";
import type { ReviewMatch } from "./types";

// Map review.occasion strings (loose Spanish labels in REVIEWS) → typed Occasion.
// Boda → anniversary because Diva does not sell standalone wedding products
// (weddings are inquiry-only); anniversary is the closest celebratory retail
// category and the proof signal still applies.
const OCCASION_MAP: Record<string, Occasion> = {
  Boda: "anniversary",
  Cumpleaños: "birthday",
};

function quoteFor(text: { en: string; es: string }, max = 140): string {
  const s = text.en.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function matchReviews(
  reviews: Review[],
  aggregate: ReviewsAggregate,
  occasions: Occasion[],
): ReviewMatch {
  const targetOccasion = occasions[0] ?? null;

  const matchingReviews = targetOccasion
    ? reviews.filter((r) => {
        if (!r.occasion) return false;
        return OCCASION_MAP[r.occasion] === targetOccasion;
      })
    : [];

  const useFallback = matchingReviews.length === 0;
  const pool = useFallback ? reviews : matchingReviews;
  const picks = pool.slice(0, 2);

  return {
    matched: picks.map((r) => ({
      id: r.id,
      author: r.author,
      initials: r.initials,
      quote: quoteFor(r.text),
    })),
    aggregateRating: aggregate.rating,
    aggregateCount: aggregate.total,
    matchedCount: matchingReviews.length,
    usedFallback: useFallback,
    occasionLabelKey: useFallback ? null : targetOccasion,
  };
}
