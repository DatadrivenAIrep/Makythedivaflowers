// tests/unit/conversion/PdpReviewsBlock.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PdpReviewsBlock } from "@/components/conversion/PdpReviewsBlock";
import { ELFSIGHT_APPS } from "@/data/elfsight";
import { CONV_EVENTS } from "@/lib/conversion/events";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string, vars?: Record<string, unknown>) => {
    if (vars) return `${ns ?? ""}.${k}|${JSON.stringify(vars)}`;
    return `${ns ?? ""}.${k}`;
  },
}));

describe("PdpReviewsBlock", () => {
  it("mounts the product-page Elfsight widget, not the site-wide one", () => {
    const { container } = render(<PdpReviewsBlock />);
    expect(
      container.querySelector(`.elfsight-app-${ELFSIGHT_APPS.productReviews}`),
    ).not.toBeNull();
    expect(
      container.querySelector(`.elfsight-app-${ELFSIGHT_APPS.siteReviews}`),
    ).toBeNull();
  });

  it("keeps firing the pdp_reviews_view conversion event", () => {
    const { container } = render(<PdpReviewsBlock />);
    expect(
      container.querySelector(`[data-conv-event="${CONV_EVENTS.reviews.view}"]`),
    ).not.toBeNull();
  });

  it("labels the section for screen readers", () => {
    render(<PdpReviewsBlock />);
    expect(screen.getByRole("region", { name: /aria_section/ })).toBeInTheDocument();
  });
});
