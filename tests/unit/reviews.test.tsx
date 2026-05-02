import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildReviewsJsonLd, type Review } from "@/data/reviews";
import { GoogleReviewsCard } from "@/components/home/GoogleReviewsCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    article: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: any) => (
      <article {...props}>{children}</article>
    ),
    span: ({ children, initial: _i, animate: _a, transition: _t, style, ...props }: any) => (
      <span style={style} {...props}>{children}</span>
    ),
  },
}));

import { GoogleReviewsClient } from "@/components/home/GoogleReviewsClient";

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

const clientReviews: Review[] = [
  {
    id: "r1",
    author: "Alice B.",
    initials: "AB",
    rating: 5,
    occasion: "Boda",
    date: "2026-04",
    text: { en: "First review in English.", es: "Primera reseña en español." },
    originalLang: "en",
  },
  {
    id: "r2",
    author: "Carlos M.",
    initials: "CM",
    rating: 5,
    date: "2026-03",
    text: { en: "Second review in English.", es: "Segunda reseña en español." },
    originalLang: "es",
  },
  {
    id: "r3",
    author: "Diana P.",
    initials: "DP",
    rating: 5,
    date: "2026-02",
    text: { en: "Third review in English.", es: "Tercera reseña en español." },
    originalLang: "en",
  },
];

describe("GoogleReviewsClient", () => {
  it("renders the first review on mount", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
  });

  it("advances to the next review when next arrow is clicked", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("wraps from last to first on next click", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
  });

  it("goes to previous review on prev click; wraps from first to last", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    await user.click(screen.getByRole("button", { name: "aria.prev" }));
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("jumps to a review when a progress segment is clicked", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const segments = screen.getAllByRole("tab");
    await user.click(segments[2]);
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("does NOT show translate chip when locale matches originalLang", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // r1 has originalLang "en", locale is "en" — no chip
    expect(screen.queryByText("translated")).not.toBeInTheDocument();
  });

  it("shows translate chip for a review in a different original language", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // r2 has originalLang "es", locale is "en" — chip should appear
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("translated")).toBeInTheDocument();
  });

  it("toggling translate chip shows original text; resets on slide change", async () => {
    const user = userEvent.setup();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    // go to r2 (originalLang "es", locale "en" → shows en text, chip visible)
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
    // click chip → show original (es)
    await user.click(screen.getByText("translated"));
    expect(screen.getByText("Segunda reseña en español.")).toBeInTheDocument();
    // navigate away and back → resets to translated
    await user.click(screen.getByRole("button", { name: "aria.next" }));
    await user.click(screen.getByRole("button", { name: "aria.prev" }));
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("advances review on ArrowRight keydown", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const container = document.querySelector("[data-reviews-client]")!;
    fireEvent.keyDown(container, { key: "ArrowRight" });
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
  });

  it("goes back on ArrowLeft keydown", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const container = document.querySelector("[data-reviews-client]")!;
    fireEvent.keyDown(container, { key: "ArrowLeft" });
    expect(screen.getByText("Third review in English.")).toBeInTheDocument();
  });

  it("autoplay advances review after interval", async () => {
    vi.useFakeTimers();
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={3000}
      />,
    );
    expect(screen.getByText("First review in English.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Second review in English.")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("active progress segment has aria-selected=true", () => {
    render(
      <GoogleReviewsClient
        reviews={clientReviews}
        locale="en"
        autoplayMs={0}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });
});
