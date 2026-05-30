import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeddingStoryCard } from "@/components/weddings/WeddingStoryCard";
import type { WeddingEvent } from "@/data/wedding-events";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const mockEvent: WeddingEvent = {
  id: "test-event",
  venue: { en: "Test Venue EN", es: "Test Venue ES" },
  date: { en: "January 1, 2025", es: "1 de enero de 2025" },
  heroSrc: "/weddings/01.webp",
  heroAlt: { en: "Hero alt en", es: "Hero alt es" },
  photos: [
    { src: "/weddings/01.webp", alt: { en: "p1 en", es: "p1 es" } },
    { src: "/weddings/02.webp", alt: { en: "p2 en", es: "p2 es" } },
    { src: "/weddings/03.webp", alt: { en: "p3 en", es: "p3 es" } },
  ],
};

describe("WeddingStoryCard", () => {
  it("renders venue name in English", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(screen.getAllByText("Test Venue EN").length).toBeGreaterThan(0);
  });

  it("renders venue name in Spanish", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="es" onOpen={() => {}} />
    );
    expect(screen.getAllByText("Test Venue ES").length).toBeGreaterThan(0);
  });

  it("renders the formatted date", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(screen.getByText("January 1, 2025")).toBeInTheDocument();
  });

  it("renders the photo count badge", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    // t("photo_count", { count: 3 }) returns "photo_count" with the mock
    expect(screen.getByText(/photo_count/)).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={onOpen} />
    );
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("calls onOpen on Enter key", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={onOpen} />
    );
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalled();
  });

  it("has an accessible label with venue name", () => {
    render(
      <WeddingStoryCard event={mockEvent} index={0} locale="en" onOpen={() => {}} />
    );
    expect(
      screen.getByRole("button", { name: /Test Venue EN/i })
    ).toBeInTheDocument();
  });
});
