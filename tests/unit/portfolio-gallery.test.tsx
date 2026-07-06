// tests/unit/portfolio-gallery.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const events: PortfolioEvent[] = [
  { id: "a", kind: "event", venue: { en: "One", es: "Uno" }, date: { en: "", es: "" }, media: [{ type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "x", es: "x" } }] },
  { id: "b", kind: "event", venue: { en: "Two", es: "Dos" }, date: { en: "", es: "" }, media: [{ type: "video", src: "/events/evento-03/v01.mp4", poster: "/events/evento-03/v01.webp", alt: { en: "y", es: "y" } }] },
];

describe("PortfolioGallery", () => {
  it("renders eyebrow, title and one card per event", () => {
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBe(events.length);
  });

  it("has a CTA link to #inquire", () => {
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    expect(screen.getByRole("link", { name: /cta/ })).toHaveAttribute("href", "#inquire");
  });

  it("opens the lightbox on card click and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PortfolioGallery events={events} namespace="events.portfolio" locale="en" />);
    await user.click(screen.getAllByRole("button")[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
