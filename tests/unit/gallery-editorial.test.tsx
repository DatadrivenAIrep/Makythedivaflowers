import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryEditorial", () => {
  it("renders an eyebrow and title", () => {
    render(<GalleryEditorial locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders all 17 photos at least once across mosaics + heroes", () => {
    render(<GalleryEditorial locale="en" />);
    weddingPortfolio.forEach((p) => {
      expect(screen.getAllByAltText(p.alt.en).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens the lightbox when a mosaic tile is clicked", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const firstPhoto = weddingPortfolio[0];
    const buttons = screen.getAllByRole("button", { name: firstPhoto.alt.en });
    await user.click(buttons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the lightbox when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const buttons = screen.getAllByRole("button", { name: weddingPortfolio[0].alt.en });
    await user.click(buttons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
