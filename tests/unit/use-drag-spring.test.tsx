// tests/unit/use-drag-spring.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useDragSpring } from "@/components/motion/useDragSpring";
import type { MotionValue } from "framer-motion";

// Captured so the test can assert on the live MotionValue directly: jsdom
// renders a plain (non-`motion.`) <div> here, so React never turns
// style={{ y: value }} into a real `style` attribute — checking the DOM
// attribute can't reflect the animation, only the MotionValue itself can.
let capturedValue: MotionValue<number> | null = null;

function Harness() {
  const { value, bind, animateTo } = useDragSpring({ axis: "y", snapPoints: [0, 300] });
  capturedValue = value;
  return (
    <div>
      <div data-testid="sheet" {...bind} style={{ y: value } as unknown as React.CSSProperties}>sheet</div>
      <button onClick={() => animateTo(300)}>close</button>
    </div>
  );
}

beforeEach(() => {
  // useReducedMotion reads matchMedia; default to "no reduce"
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

describe("useDragSpring", () => {
  it("renders and exposes a bindable element", () => {
    render(<Harness />);
    const el = screen.getByTestId("sheet");
    expect(el).toBeInTheDocument();
    // pointer-down handler is attached (fireEvent is jsdom-safe; no throw)
    fireEvent.pointerDown(el, { clientY: 10 });
    expect(el).toBeInTheDocument();
  });

  it("animateTo drives the value toward the target snap point", async () => {
    render(<Harness />);
    screen.getByTestId("sheet");
    await act(async () => {
      screen.getByText("close").click();
      await new Promise((r) => setTimeout(r, 500)); // let the spring settle
    });
    // jsdom can't reflect a MotionValue into a real `style` attribute on a
    // plain (non-`motion.`) element, so assert on the live value instead of
    // the DOM attribute (see note on `capturedValue` above).
    expect(capturedValue?.get()).toBeCloseTo(300, 0);
  });

  it("removes window listeners on unmount after a drag starts", () => {
    const removed: string[] = [];
    const origAdd = window.addEventListener;
    const origRemove = window.removeEventListener;
    const addSpy = vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener").mockImplementation((type, ...a) => {
      removed.push(String(type));
      return (origRemove as typeof window.removeEventListener).call(window, type, ...a);
    });
    const { unmount } = render(<Harness />);
    const el = screen.getByTestId("sheet");
    fireEvent.pointerDown(el, { clientY: 10 }); // starts a drag → window listeners added
    expect(addSpy.mock.calls.some(([t]) => t === "pointermove")).toBe(true);
    act(() => { unmount(); }); // unmount mid-drag
    expect(removed).toContain("pointermove");
    expect(removed).toContain("pointerup");
    (window.addEventListener as unknown) = origAdd; (window.removeEventListener as unknown) = origRemove;
  });
});
