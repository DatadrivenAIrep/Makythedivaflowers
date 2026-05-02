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

import { GoogleReviewsCard } from "@/components/home/GoogleReviewsCard";

const baseCardProps = {
  author: "Jessica Morales",
  initials: "JM",
  displayText: "Amazing flowers for our wedding.",
  date: "2026-04",
  locale: "en" as const,
  occasion: "Boda",
  showTranslateChip: false,
  showingOriginal: false,
  translateLabel: "Translated · view original",
  originalLabel: "Showing original",
  onToggleTranslate: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  prevLabel: "Previous review",
  nextLabel: "Next review",
};

describe("GoogleReviewsCard", () => {
  it("renders the display text", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText("Amazing flowers for our wedding.")).toBeInTheDocument();
  });

  it("renders the author name", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText("Jessica Morales")).toBeInTheDocument();
  });

  it("renders formatted date and occasion", () => {
    render(<GoogleReviewsCard {...baseCardProps} />);
    expect(screen.getByText(/April 2026.*Boda/)).toBeInTheDocument();
  });

  it("does not render translate chip when showTranslateChip is false", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={false} />);
    expect(screen.queryByText("Translated · view original")).not.toBeInTheDocument();
  });

  it("renders translate chip when showTranslateChip is true", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} />);
    expect(screen.getByText("Translated · view original")).toBeInTheDocument();
  });

  it("shows originalLabel when showingOriginal is true", () => {
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} showingOriginal={true} />);
    expect(screen.getByText("Showing original")).toBeInTheDocument();
    expect(screen.queryByText("Translated · view original")).not.toBeInTheDocument();
  });

  it("calls onToggleTranslate when translate chip is clicked", async () => {
    const user = userEvent.setup();
    const onToggleTranslate = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} showTranslateChip={true} onToggleTranslate={onToggleTranslate} />);
    await user.click(screen.getByText("Translated · view original"));
    expect(onToggleTranslate).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when next arrow is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Next review" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev when prev arrow is clicked", async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    render(<GoogleReviewsCard {...baseCardProps} onPrev={onPrev} />);
    await user.click(screen.getByRole("button", { name: "Previous review" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
