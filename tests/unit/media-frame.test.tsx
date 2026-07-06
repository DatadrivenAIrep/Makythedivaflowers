// tests/unit/media-frame.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaFrame } from "@/components/portfolio/MediaFrame";
import type { MediaItem } from "@/types/portfolio";

const photo: MediaItem = { type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "Event photo", es: "Foto de evento" } };
const video: MediaItem = { type: "video", src: "/weddings/boda-02/v01.mp4", poster: "/weddings/boda-02/v01.webp", alt: { en: "Wedding film", es: "Video de boda" } };

describe("MediaFrame", () => {
  it("renders an image for a photo item", () => {
    render(<MediaFrame item={photo} locale="en" sizes="100vw" />);
    expect(screen.getByAltText("Event photo")).toBeInTheDocument();
  });

  it("renders a looping muted inline video for a video item", () => {
    const { container } = render(<MediaFrame item={video} locale="en" />);
    const el = container.querySelector("video");
    expect(el).not.toBeNull();
    expect(el!.getAttribute("src")).toBe("/weddings/boda-02/v01.mp4");
    expect(el!.getAttribute("poster")).toBe("/weddings/boda-02/v01.webp");
    expect(el!.hasAttribute("loop")).toBe(true);
    expect(el!.hasAttribute("playsinline")).toBe(true);
    expect(el!.getAttribute("aria-label")).toBe("Wedding film");
  });

  it("uses the es alt for locale es", () => {
    render(<MediaFrame item={photo} locale="es" sizes="100vw" />);
    expect(screen.getByAltText("Foto de evento")).toBeInTheDocument();
  });
});
