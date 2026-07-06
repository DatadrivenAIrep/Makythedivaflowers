// tests/unit/media-lightbox.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaLightbox } from "@/components/portfolio/MediaLightbox";
import type { PortfolioEvent } from "@/types/portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const event: PortfolioEvent = {
  id: "test-event",
  kind: "event",
  venue: { en: "Private Event", es: "Evento privado" },
  date: { en: "", es: "" },
  media: [
    { type: "photo", src: "/events/evento-01/p01.webp", alt: { en: "Photo 1 en", es: "Foto 1 es" } },
    { type: "video", src: "/events/evento-03/v01.mp4", poster: "/events/evento-03/v01.webp", alt: { en: "Video 1 en", es: "Video 1 es" } },
  ],
};

describe("MediaLightbox", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(<MediaLightbox event={null} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a dialog with the venue and the first (photo) item", () => {
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Private Event")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 1 en")).toBeInTheDocument();
  });

  it("shows a <video> with controls when navigated to a video item", async () => {
    const user = userEvent.setup();
    const { container } = render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "next" }));
    const vid = container.querySelector("video");
    expect(vid).not.toBeNull();
    expect(vid!.hasAttribute("controls")).toBe(true);
    expect(vid!.getAttribute("src")).toBe("/events/evento-03/v01.mp4");
    expect(vid!.getAttribute("poster")).toBe("/events/evento-03/v01.webp");
  });

  it("calls onClose on the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders one thumbnail per media item", () => {
    render(<MediaLightbox event={event} locale="en" namespace="events.portfolio" onClose={() => {}} />);
    const thumbs = screen.getAllByRole("button", { name: /go_to/ });
    expect(thumbs).toHaveLength(2);
  });
});
