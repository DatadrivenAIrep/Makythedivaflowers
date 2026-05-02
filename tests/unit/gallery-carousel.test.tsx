import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryCarousel } from "@/components/weddings/gallery/GalleryCarousel";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const onOpen = vi.fn();

describe("GalleryCarousel", () => {
  it("renders one thumbnail per photo", () => {
    render(<GalleryCarousel photos={weddingPortfolio} locale="en" onOpen={onOpen} autoplayMs={0} />);
    const thumbs = screen.getAllByRole("button", { name: /go_to/i });
    expect(thumbs).toHaveLength(weddingPortfolio.length);
  });

  it("advances to the next photo when next is clicked", async () => {
    const user = userEvent.setup();
    render(<GalleryCarousel photos={weddingPortfolio} locale="en" onOpen={onOpen} autoplayMs={0} />);
    // Initially the first photo's alt should be present in the active slide button
    expect(screen.getByRole("button", { name: new RegExp(weddingPortfolio[0].alt.en) })).toBeInTheDocument();
    // There are two "next" buttons: the arrow and the right side-peek. Either advances; click the first.
    await user.click(screen.getAllByRole("button", { name: "next" })[0]);
    // After clicking next, the second photo is active
    expect(await screen.findByRole("button", { name: new RegExp(weddingPortfolio[1].alt.en) })).toBeInTheDocument();
  });

  it("calls onOpen with the active index when the active slide is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<GalleryCarousel photos={weddingPortfolio} locale="en" onOpen={handler} autoplayMs={0} />);
    const slide = screen.getByRole("button", { name: new RegExp(weddingPortfolio[0].alt.en) });
    await user.click(slide);
    expect(handler).toHaveBeenCalledWith(0);
  });

  it("jumps to a thumbnail when clicked", async () => {
    const user = userEvent.setup();
    render(<GalleryCarousel photos={weddingPortfolio} locale="en" onOpen={onOpen} autoplayMs={0} />);
    const thirdThumb = screen.getAllByRole("button", { name: /go_to/i })[2];
    await user.click(thirdThumb);
    expect(await screen.findByRole("button", { name: new RegExp(weddingPortfolio[2].alt.en) })).toBeInTheDocument();
  });
});
