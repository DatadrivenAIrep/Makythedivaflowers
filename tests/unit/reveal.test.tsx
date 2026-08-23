import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
