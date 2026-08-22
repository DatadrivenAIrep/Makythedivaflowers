import { describe, it, expect } from "vitest";
import { SPRING, project, projectSnap, normalizeVelocity, rubberband } from "@/lib/motion";

describe("SPRING presets", () => {
  it("default is critically damped (no overshoot)", () => {
    expect(SPRING.default).toMatchObject({ type: "spring", bounce: 0 });
  });
  it("momentum and drawer carry a little bounce", () => {
    expect(SPRING.momentum.bounce).toBeGreaterThan(0);
    expect(SPRING.drawer.bounce).toBeGreaterThan(0);
  });
});

describe("project", () => {
  it("returns 0 for no velocity", () => {
    expect(project(0)).toBe(0);
  });
  it("uses exponential decay: v=1000 -> ~499px at 0.998", () => {
    expect(project(1000, 0.998)).toBeCloseTo(499, 0);
  });
  it("preserves direction", () => {
    expect(project(-1000, 0.998)).toBeCloseTo(-499, 0);
  });
});

describe("projectSnap", () => {
  it("throws to the snap nearest the projected endpoint, not the release point", () => {
    // release at 0, fast flick -> endpoint ~499 -> nearest of [0,200,600] is 600
    expect(projectSnap(0, 1000, [0, 200, 600])).toBe(600);
  });
  it("with no velocity, snaps to the nearest point to current", () => {
    expect(projectSnap(210, 0, [0, 200, 600])).toBe(200);
  });
});

describe("normalizeVelocity", () => {
  it("divides velocity by remaining distance", () => {
    expect(normalizeVelocity(50, 150, 50)).toBeCloseTo(0.5, 5);
  });
  it("guards divide-by-zero at target", () => {
    expect(normalizeVelocity(50, 50, 50)).toBe(0);
  });
});

describe("rubberband", () => {
  it("is 0 at the boundary", () => {
    expect(rubberband(0, 300)).toBe(0);
  });
  it("resists: output is always less than the raw overshoot", () => {
    expect(rubberband(100, 300)).toBeLessThan(100);
  });
  it("has diminishing returns as overshoot grows", () => {
    const a = rubberband(100, 300) - rubberband(0, 300);
    const b = rubberband(200, 300) - rubberband(100, 300);
    expect(b).toBeLessThan(a);
  });
  it("preserves sign", () => {
    expect(rubberband(-100, 300)).toBeLessThan(0);
  });
});
