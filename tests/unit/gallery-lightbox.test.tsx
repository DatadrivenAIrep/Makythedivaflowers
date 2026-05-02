import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryLightbox } from "@/components/weddings/gallery/GalleryLightbox";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryLightbox", () => {
  it("renders the active photo and a dialog", () => {
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={2}
        locale="en"
        onClose={() => {}}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText(weddingPortfolio[2].alt.en)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={onClose}
        onChange={() => {}}
      />
    );
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onChange with next index on right arrow click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={() => {}}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("wraps around when navigating past the last photo", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={weddingPortfolio.length - 1}
        locale="en"
        onClose={() => {}}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("closes on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={onClose}
        onChange={() => {}}
      />
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
