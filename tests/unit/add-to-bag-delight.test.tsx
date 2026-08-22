import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useUIStore } from "@/lib/ui-store";
import { AddToBagDelight } from "@/components/cart/AddToBagDelight";

function setReduce(m: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("reduced-motion") ? m : false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

function overlay(container: HTMLElement) {
  return container.querySelector("[aria-hidden].pointer-events-none");
}

beforeEach(() => {
  vi.useFakeTimers();
  setReduce(false);
  useUIStore.setState({ toast: null });
});

afterEach(() => {
  useUIStore.setState({ toast: null });
  vi.useRealTimers();
  cleanup();
});

describe("AddToBagDelight", () => {
  it("renders nothing before any toast fires", () => {
    const { container } = render(<AddToBagDelight />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the petal burst overlay on an added-to-bag toast and only hides it after 4000ms", () => {
    const { container } = render(<AddToBagDelight />);

    act(() => {
      useUIStore.setState({ toast: { kind: "added-to-bag" } });
    });
    expect(overlay(container)).not.toBeNull();

    // The old 2600ms teardown used to cut the 2.4-3.6s burst mid-fall -- it
    // must still be showing at that point now.
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(overlay(container)).not.toBeNull();

    // ...and gone once the full 4000ms (worst-case burst + stagger) elapses.
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(overlay(container)).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("replays on a rapid re-add by extending/restarting the hide timer", () => {
    const { container } = render(<AddToBagDelight />);

    act(() => {
      useUIStore.setState({ toast: { kind: "added-to-bag" } });
    });
    expect(overlay(container)).not.toBeNull();

    // Re-add partway through the first burst's window (a new toast object,
    // same kind -- this is what a rapid second "Add to bag" click produces).
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      useUIStore.setState({ toast: { kind: "added-to-bag" } });
    });

    // 2000ms (already elapsed) + 2600ms = 4600ms since the FIRST add, but
    // only 2600ms since the second -- if the timer weren't reset/replayed by
    // the second toast, the overlay would already be hidden here.
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(overlay(container)).not.toBeNull();

    // Now 4000ms since the second add: it hides.
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(overlay(container)).toBeNull();
  });
});
