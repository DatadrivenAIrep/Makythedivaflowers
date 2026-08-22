// tests/unit/hero-media.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HeroMedia } from "@/components/home/HeroMedia";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("prefers-reduced-motion") ? matches : false,
    media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => setReducedMotion(false));

describe("HeroMedia", () => {
  it("plays video when motion is allowed", async () => {
    render(<HeroMedia src="/hero/divavideo.mp4" poster="/hero/divavideo-poster.jpg" />);
    await waitFor(() => {
      expect(document.querySelector("video")).toBeInTheDocument();
    });
  });

  it("falls back to a static poster image under reduced motion", async () => {
    setReducedMotion(true);
    render(<HeroMedia src="/hero/divavideo.mp4" poster="/hero/divavideo-poster.jpg" />);
    await waitFor(() => {
      expect(screen.getByRole("presentation")).toHaveAttribute("src", "/hero/divavideo-poster.jpg");
    });
    expect(document.querySelector("video")).not.toBeInTheDocument();
  });
});
