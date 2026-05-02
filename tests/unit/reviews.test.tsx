import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildReviewsJsonLd, type Review } from "@/data/reviews";

const mockAggregate = { rating: 4.9, total: 127, placeUrl: "https://g.page/r/test" } as const;

const mockReviews: Review[] = [
  {
    id: "jessica-morales-2026-04",
    author: "Jessica Morales",
    initials: "JM",
    rating: 5,
    occasion: "Boda",
    date: "2026-04",
    text: { en: "Amazing flowers for our wedding.", es: "Flores increíbles para nuestra boda." },
    originalLang: "es",
  },
  {
    id: "carmen-diaz-2026-03",
    author: "Carmen Díaz",
    initials: "CD",
    rating: 5,
    date: "2026-03",
    text: { en: "Best flowers in Long Island.", es: "Las mejores flores de Long Island." },
    originalLang: "en",
  },
];

describe("buildReviewsJsonLd", () => {
  it("returns valid JSON-LD with AggregateRating and Review entries", () => {
    const parsed = JSON.parse(buildReviewsJsonLd(mockReviews, mockAggregate, "Diva Flowers"));
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("LocalBusiness");
    expect(parsed.name).toBe("Diva Flowers");
    expect(parsed.aggregateRating["@type"]).toBe("AggregateRating");
    expect(parsed.aggregateRating.ratingValue).toBe(4.9);
    expect(parsed.aggregateRating.reviewCount).toBe(127);
    expect(parsed.review).toHaveLength(2);
    expect(parsed.review[0].author.name).toBe("Jessica Morales");
    expect(parsed.review[0].datePublished).toBe("2026-04");
    expect(parsed.review[0].reviewBody).toBe("Amazing flowers for our wedding.");
    expect(parsed.review[0].reviewRating.ratingValue).toBe(5);
    expect(parsed.review[0].reviewRating.bestRating).toBe(5);
  });
});
