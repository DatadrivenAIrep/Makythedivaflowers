import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { buildReviewsJsonLd, type Review } from "@/data/reviews";

import { ElfsightReviews } from "@/components/social/ElfsightReviews";
import { ELFSIGHT_APPS } from "@/data/elfsight";

/**
 * Hands back the IntersectionObserver callback so a test can decide when the
 * section "enters" the viewport. jsdom has no real observer.
 */
function stubIntersectionObserver() {
  let trigger: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        trigger = cb;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn();
      root = null;
      rootMargin = "";
      thresholds = [];
    },
  );
  return {
    observe,
    disconnect,
    enterViewport: () => act(() => trigger?.([{ isIntersecting: true }])),
    stayOutOfViewport: () => act(() => trigger?.([{ isIntersecting: false }])),
  };
}

const APP_ID = ELFSIGHT_APPS.siteReviews;

const platformScripts = () =>
  [...document.querySelectorAll('script[src="https://elfsightcdn.com/platform.js"]')];

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
    const parsed = JSON.parse(
      buildReviewsJsonLd(mockReviews, mockAggregate, "Diva Flowers", "https://example.com/#florist"),
    );
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Florist");
    // Must match the Florist node in LocalBusinessLD so Google merges the two.
    expect(parsed["@id"]).toBe("https://example.com/#florist");
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

describe("ElfsightReviews", () => {
  afterEach(() => {
    cleanup();
    platformScripts().forEach((el) => el.remove());
    vi.unstubAllGlobals();
  });

  it("renders the Elfsight mount point with the widget id", () => {
    stubIntersectionObserver();
    const { container } = render(<ElfsightReviews appId={APP_ID} />);
    // platform.js finds the widget by this exact class; a typo silently
    // renders nothing, so pin it.
    expect(
      container.querySelector(`.elfsight-app-${APP_ID}`),
    ).not.toBeNull();
  });

  it("keeps the mount point lazy so the widget waits for the viewport", () => {
    stubIntersectionObserver();
    const { container } = render(<ElfsightReviews appId={APP_ID} />);
    const mount = container.querySelector(`.elfsight-app-${APP_ID}`);
    expect(mount).toHaveAttribute("data-elfsight-app-lazy");
  });

  it("does not fetch platform.js until the section nears the viewport", () => {
    const io = stubIntersectionObserver();
    render(<ElfsightReviews appId={APP_ID} />);
    expect(platformScripts()).toHaveLength(0);

    io.stayOutOfViewport();
    expect(platformScripts()).toHaveLength(0);
  });

  it("appends platform.js once the section enters the viewport", () => {
    const io = stubIntersectionObserver();
    render(<ElfsightReviews appId={APP_ID} />);

    io.enterViewport();

    const [script] = platformScripts();
    expect(script).toBeDefined();
    expect((script as HTMLScriptElement).async).toBe(true);
    // One shot only — the observer stops watching after the first hit.
    expect(io.disconnect).toHaveBeenCalled();
  });

  it("never appends platform.js twice", () => {
    const io = stubIntersectionObserver();
    render(<ElfsightReviews appId={APP_ID} />);
    io.enterViewport();

    // A second widget — another mount, or a client-side navigation back to
    // this page — must reuse the script already on the document.
    const second = stubIntersectionObserver();
    render(<ElfsightReviews appId={ELFSIGHT_APPS.productReviews} />);
    second.enterViewport();

    expect(platformScripts()).toHaveLength(1);
  });

  it("mounts each widget under its own Elfsight id", () => {
    stubIntersectionObserver();
    const { container } = render(<ElfsightReviews appId={ELFSIGHT_APPS.productReviews} />);
    expect(
      container.querySelector(`.elfsight-app-${ELFSIGHT_APPS.productReviews}`),
    ).not.toBeNull();
    expect(ELFSIGHT_APPS.productReviews).not.toBe(ELFSIGHT_APPS.siteReviews);
  });

  it("loads immediately where IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<ElfsightReviews appId={APP_ID} />);
    expect(platformScripts()).toHaveLength(1);
  });
});
