// tests/unit/behind-the-scenes-video.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AmbientLoop } from "@/components/media/AmbientLoop";
import { MakingOfPlayer } from "@/components/story/MakingOfPlayer";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("prefers-reduced-motion") ? matches : false,
    media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  setReducedMotion(false);
  // jsdom has no media playback
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

const loopProps = {
  src: "/story/behind-the-scenes-loop.mp4",
  poster: "/story/behind-the-scenes-poster.webp",
  pauseLabel: "Pause video",
  playLabel: "Play video",
};

describe("AmbientLoop", () => {
  it("renders a muted, lazy video with a pause toggle", async () => {
    render(<AmbientLoop {...loopProps} />);
    const video = await waitFor(() => {
      const v = document.querySelector("video");
      expect(v).toBeInTheDocument();
      return v!;
    });
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("preload", "none");
    expect(screen.getByRole("button", { name: /play video|pause video/i })).toBeInTheDocument();
  });

  it("shows only the poster under reduced motion", async () => {
    setReducedMotion(true);
    render(<AmbientLoop {...loopProps} />);
    await waitFor(() => {
      expect(screen.getByRole("presentation")).toHaveAttribute("src", loopProps.poster);
    });
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("MakingOfPlayer", () => {
  const props = {
    src: "/story/making-of.mp4",
    poster: "/story/making-of-poster.webp",
    playLabel: "Play the film",
    videoLabel: "Video: Maky builds two arrangements",
    duration: "0:46",
  };

  it("loads nothing until the viewer presses play", () => {
    render(<MakingOfPlayer {...props} />);
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play the film (0:46)" })).toBeInTheDocument();
  });

  it("swaps in a controlled video with sound on click", async () => {
    render(<MakingOfPlayer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /play the film/i }));
    const video = await waitFor(() => {
      const v = document.querySelector("video");
      expect(v).toBeInTheDocument();
      return v!;
    });
    expect(video).toHaveAttribute("controls");
    expect(video.muted).toBe(false);
    expect(video).toHaveAttribute("aria-label", props.videoLabel);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
