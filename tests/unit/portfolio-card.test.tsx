// tests/unit/portfolio-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const event: PortfolioEvent = {
  id: "test",
  kind: "wedding",
  venue: { en: "Private Wedding", es: "Boda privada" },
  date: { en: "", es: "" },
  media: [
    { type: "photo", src: "/weddings/boda-01/p01.webp", alt: { en: "a", es: "a" } },
    { type: "video", src: "/weddings/boda-01/v01.mp4", poster: "/weddings/boda-01/v01.webp", alt: { en: "b", es: "b" } },
  ],
};

describe("PortfolioCard", () => {
  it("renders the venue and an accessible open label", () => {
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={() => {}} />);
    expect(screen.getAllByText("Private Wedding").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Private Wedding/i })).toBeInTheDocument();
  });

  it("renders the media count label", () => {
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={() => {}} />);
    expect(screen.getByText(/media_count/)).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<PortfolioCard event={event} index={0} locale="en" namespace="weddings.stories" onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
});
