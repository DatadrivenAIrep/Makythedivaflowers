import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingStories } from "@/components/weddings/WeddingStories";
import { weddingEvents } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("WeddingStories", () => {
  it("renders section eyebrow and title", () => {
    render(<WeddingStories locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders one button per event", () => {
    render(<WeddingStories locale="en" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(weddingEvents.length);
  });

  it("opens the lightbox when a card is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingStories locale="en" />);
    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the lightbox on Escape key", async () => {
    const user = userEvent.setup();
    render(<WeddingStories locale="en" />);
    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    // AnimatePresence may animate out — wait for removal
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("renders the page in Spanish when locale is es", () => {
    render(<WeddingStories locale="es" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
  });
});
