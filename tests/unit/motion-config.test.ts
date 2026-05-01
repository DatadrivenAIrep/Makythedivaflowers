import { describe, it, expect } from "vitest";
import { springs, easings } from "@/lib/motion-config";

describe("springs", () => {
  it("exports a 'soft' preset with stiffness 100, damping 20", () => {
    expect(springs.soft).toEqual({ type: "spring", stiffness: 100, damping: 20 });
  });
  it("exports an 'overshoot' preset", () => {
    expect(springs.overshoot.stiffness).toBeGreaterThanOrEqual(180);
    expect(springs.overshoot.damping).toBeLessThan(20);
  });
});

describe("easings", () => {
  it("exposes elegant cubic-bezier", () => {
    expect(easings.elegant).toEqual([0.16, 1, 0.3, 1]);
  });
});
