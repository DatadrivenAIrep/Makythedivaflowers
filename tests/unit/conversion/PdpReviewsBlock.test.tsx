// tests/unit/conversion/PdpReviewsBlock.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PdpReviewsBlock } from "@/components/conversion/PdpReviewsBlock";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string, vars?: Record<string, unknown>) => {
    if (vars) return `${ns ?? ""}.${k}|${JSON.stringify(vars)}`;
    return `${ns ?? ""}.${k}`;
  },
}));

const baseProduct = (overrides: Partial<Product>): Product => ({
  id: "p1",
  slug: "p1",
  title: { en: "P1", es: "P1" },
  category: "arrangements",
  blurb: { en: "", es: "" },
  description: { en: "", es: "" },
  images: [],
  variants: [],
  tags: [],
  occasions: [],
  colorFamily: ["red"],
  active: true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...overrides,
});

describe("PdpReviewsBlock", () => {
  it("renders the global aggregate when product has no occasion", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: [] })} locale="en" />);
    expect(screen.getByText(/conversion\.reviews\.rating_aggregate\|/)).toBeInTheDocument();
  });

  it("renders the matched aggregate when product has anniversary occasion", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: ["anniversary"] })} locale="en" />);
    expect(screen.getByText(/conversion\.reviews\.rating_aggregate_matched\|/)).toBeInTheDocument();
  });

  it("renders two review quotes", () => {
    const { container } = render(<PdpReviewsBlock product={baseProduct({ occasions: ["anniversary"] })} locale="en" />);
    expect(container.querySelectorAll("blockquote").length).toBe(2);
  });

  it("includes a Read all reviews link to the Google place URL", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: [] })} locale="en" />);
    const link = screen.getByRole("link", { name: /read_all_cta/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("google.com/maps"));
    expect(link).toHaveAttribute("target", "_blank");
  });
});
