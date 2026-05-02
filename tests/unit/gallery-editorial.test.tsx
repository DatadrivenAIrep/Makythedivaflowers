import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders a carousel region", () => {
    render(<GalleryEditorial locale="en" />);
    expect(screen.getByRole("region", { name: "carousel_label" })).toBeInTheDocument();
  });

  it("opens the lightbox when the active carousel slide is clicked", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const firstAlt = weddingPortfolio[0].alt.en;
    const slide = screen.getByRole("button", { name: new RegExp(firstAlt) });
    await user.click(slide);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the lightbox when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const slide = screen.getByRole("button", { name: new RegExp(weddingPortfolio[0].alt.en) });
    await user.click(slide);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).toHaveStyle({ opacity: "0" }));
  });
});
