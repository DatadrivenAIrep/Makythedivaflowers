import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryHero } from "@/components/weddings/gallery/GalleryHero";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryHero", () => {
  const heroPhoto = weddingPortfolio.find((p) => p.layout === "hero")!;

  it("renders the hero image edge-to-edge with no index label", () => {
    render(<GalleryHero photo={heroPhoto} index={5} locale="en" onOpen={() => {}} />);
    expect(screen.getByAltText(heroPhoto.alt.en)).toBeInTheDocument();
    expect(screen.queryByText("06")).not.toBeInTheDocument();
  });

  it("calls onOpen with the index when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryHero photo={heroPhoto} index={5} locale="en" onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(5);
  });
});
