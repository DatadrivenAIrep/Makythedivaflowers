import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryTile } from "@/components/weddings/gallery/GalleryTile";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

const photo = {
  id: "w01",
  src: "/weddings/01.webp",
  alt: { en: "Sample wedding photo", es: "Foto de boda" },
  aspect: "4/5" as const,
  layout: "mosaic" as const,
};

describe("GalleryTile", () => {
  it("renders an image with the alt text for the locale", () => {
    render(<GalleryTile photo={photo} locale="en" index={0} onOpen={() => {}} />);
    expect(screen.getByAltText("Sample wedding photo")).toBeInTheDocument();
  });

  it("renders a button so the tile is clickable", () => {
    render(<GalleryTile photo={photo} locale="en" index={0} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Sample wedding photo" })).toBeInTheDocument();
  });

  it("calls onOpen with the index when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryTile photo={photo} locale="en" index={4} onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(4);
  });

  it("renders the index number when showIndex is true", () => {
    render(<GalleryTile photo={photo} locale="en" index={2} showIndex onOpen={() => {}} />);
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("does not render the index number when showIndex is false", () => {
    render(<GalleryTile photo={photo} locale="en" index={2} onOpen={() => {}} />);
    expect(screen.queryByText("03")).not.toBeInTheDocument();
  });
});
