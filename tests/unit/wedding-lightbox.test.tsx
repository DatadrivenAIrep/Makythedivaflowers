import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingLightbox } from "@/components/weddings/WeddingLightbox";
import type { WeddingEvent } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const mockEvent: WeddingEvent = {
  id: "test-event",
  venue: { en: "Test Venue", es: "Venue de prueba" },
  date: { en: "January 1, 2025", es: "1 de enero de 2025" },
  heroSrc: "/weddings/01.webp",
  heroAlt: { en: "Hero alt", es: "Alt hero" },
  photos: [
    { src: "/weddings/01.webp", alt: { en: "Photo 1 en", es: "Foto 1 es" } },
    { src: "/weddings/02.webp", alt: { en: "Photo 2 en", es: "Foto 2 es" } },
    { src: "/weddings/03.webp", alt: { en: "Photo 3 en", es: "Foto 3 es" } },
  ],
};

describe("WeddingLightbox", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(
      <WeddingLightbox event={null} locale="en" onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a dialog with venue name when event is provided", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Venue")).toBeInTheDocument();
  });

  it("shows the date in the top bar", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByText("January 1, 2025")).toBeInTheDocument();
  });

  it("shows the first photo's alt text", () => {
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to the next photo when the next button is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();
  });

  it("navigates to the previous photo when the prev button is clicked", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "prev" }));
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("wraps around to the last photo when navigating prev from the first", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "prev" }));
    expect(screen.getByAltText("Photo 3 en")).toBeInTheDocument();
  });

  it("wraps around to the first photo when navigating next past the last", async () => {
    const user = userEvent.setup();
    render(<WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.click(screen.getByRole("button", { name: "next" }));
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("resets to the first photo when a new event is opened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WeddingLightbox event={mockEvent} locale="en" onClose={() => {}} />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByAltText("Photo 2 en")).toBeInTheDocument();

    const anotherEvent: WeddingEvent = {
      ...mockEvent,
      id: "another-event",
      venue: { en: "Another Venue", es: "Otro venue" },
      photos: [
        { src: "/weddings/10.webp", alt: { en: "Another photo en", es: "Otra foto es" } },
      ],
    };
    rerender(<WeddingLightbox event={anotherEvent} locale="en" onClose={() => {}} />);
    expect(screen.getByAltText("Another photo en")).toBeInTheDocument();
  });

  it("renders in Spanish when locale is es", () => {
    render(<WeddingLightbox event={mockEvent} locale="es" onClose={() => {}} />);
    expect(screen.getByText("Venue de prueba")).toBeInTheDocument();
    expect(screen.getByText("1 de enero de 2025")).toBeInTheDocument();
    expect(screen.getByAltText("Foto 1 es")).toBeInTheDocument();
  });
});
