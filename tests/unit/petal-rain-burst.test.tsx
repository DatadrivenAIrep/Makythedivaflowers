import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { PetalRain } from "@/components/home/PetalRain";

function setReduce(m: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("reduced-motion") ? m : false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}
beforeEach(() => setReduce(false));

describe("PetalRain burst", () => {
  it("renders petals in burst mode", () => {
    const { container } = render(<PetalRain burst count={6} />);
    expect(container.querySelectorAll("svg").length).toBe(6);
  });
  it("renders nothing under reduced motion", () => {
    setReduce(true);
    const { container } = render(<PetalRain burst count={6} />);
    expect(container.firstChild).toBeNull();
  });
});
