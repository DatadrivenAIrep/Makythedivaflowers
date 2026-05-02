import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryMarquee } from "@/components/weddings/gallery/GalleryMarquee";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryMarquee", () => {
  it("renders every photo at least once", () => {
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={() => {}} />);
    weddingPortfolio.forEach((p) => {
      expect(screen.getAllByAltText(p.alt.en).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("uses role=region with the marquee_label", () => {
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={() => {}} />);
    expect(screen.getByRole("region", { name: "marquee_label" })).toBeInTheDocument();
  });

  it("opens the lightbox at the photo's global index when a tile is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={onOpen} />);
    const region = screen.getByRole("region", { name: "marquee_label" });
    const button = within(region).getAllByRole("button", { name: weddingPortfolio[3].alt.en })[0];
    await user.click(button);
    expect(onOpen).toHaveBeenCalledWith(3);
  });
});
