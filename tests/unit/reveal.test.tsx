import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen, act } from "@testing-library/react";
import { staggerItemVariants } from "@/components/motion/StaggerGroup";
import { Reveal } from "@/components/motion/Reveal";

describe("staggerItemVariants", () => {
  it("reveals on the shared SPRING.default (critically damped, no overshoot)", () => {
    const t = (staggerItemVariants.show as { transition: Record<string, unknown> }).transition;
    expect(t.type).toBe("spring");
    expect(t.bounce).toBe(0);
    expect(t.duration).toBe(0.4);
  });
});

describe("Reveal", () => {
  it("renders its children", () => {
    render(<Reveal>hello world</Reveal>);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("keeps a stable DOM node across a parent re-render (no remount → no reveal re-fire)", () => {
    let force!: () => void;
    function Parent() {
      const [, setN] = React.useState(0);
      force = () => setN((n) => n + 1);
      return <Reveal>persistent child</Reveal>;
    }
    render(<Parent />);
    const before = screen.getByText("persistent child");
    act(() => force());
    const after = screen.getByText("persistent child");
    // Same underlying node ⇒ the motion component type was stable, so the
    // once:true entrance is not remounted/replayed when the parent updates.
    expect(after).toBe(before);
  });
});
