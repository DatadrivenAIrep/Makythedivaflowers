// data/review-helpers.ts
import { REVIEWS, type Review } from "@/data/reviews";

/** Reviews tagged with a specific occasion (e.g. "Boda"). */
export function reviewsByOccasion(occasion: string): Review[] {
  return REVIEWS.filter((r) => r.occasion === occasion);
}

/** Reviews with no occasion tag — safe, non-misleading general proof. */
export function generalReviews(): Review[] {
  return REVIEWS.filter((r) => !r.occasion);
}
