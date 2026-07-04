// tests/unit/testimonials.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingChip } from "@/components/social/RatingChip";
import { Testimonials } from "@/components/social/Testimonials";
import type { Review } from "@/data/reviews";

const sample: Review[] = [
  {
    id: "r1",
    author: "Blanca D.",
    initials: "BD",
    rating: 5,
    occasion: "Boda",
    date: "2025-12",
    text: { en: "Beautiful bridal bouquet.", es: "Ramo de novia hermoso." },
    originalLang: "en",
  },
  {
    id: "r2",
    author: "Samantha B.",
    initials: "SB",
    rating: 5,
    occasion: "Boda",
    date: "2026-03",
    text: { en: "Made my wedding day.", es: "Hizo mi día de boda." },
    originalLang: "en",
  },
];

describe("RatingChip", () => {
  it("renders its label", () => {
    render(<RatingChip label="4.9 ★ · 127 reviews" />);
    expect(screen.getByText("4.9 ★ · 127 reviews")).toBeInTheDocument();
  });
});

describe("Testimonials", () => {
  it("renders the EN quotes, authors, eyebrow and title", () => {
    render(
      <Testimonials
        reviews={sample}
        locale="en"
        eyebrow="In their words"
        title="Couples on Diva."
      />,
    );
    expect(screen.getByText("In their words")).toBeInTheDocument();
    expect(screen.getByText("Couples on Diva.")).toBeInTheDocument();
    expect(screen.getByText(/Beautiful bridal bouquet\./)).toBeInTheDocument();
    expect(screen.getByText("Blanca D.")).toBeInTheDocument();
  });

  it("renders the ES quote text for locale es", () => {
    render(
      <Testimonials reviews={sample} locale="es" eyebrow="x" title="y" />,
    );
    expect(screen.getByText(/Ramo de novia hermoso\./)).toBeInTheDocument();
  });

  it("renders nothing when there are no reviews", () => {
    const { container } = render(
      <Testimonials reviews={[]} locale="en" eyebrow="x" title="y" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
