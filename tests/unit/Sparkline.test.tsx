import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "@/components/admin/metrics/Sparkline";

describe("Sparkline", () => {
  it("renders a polyline with one point per value (12 points)", () => {
    const { container } = render(
      <Sparkline points={[0, 5, 3, 8, 2, 9, 4, 7, 1, 6, 10, 3]} ariaLabel="trend" />,
    );
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    const coords = poly!.getAttribute("points")!.trim().split(/\s+/);
    expect(coords).toHaveLength(12);
  });

  it("renders a flat line for a single point without crashing", () => {
    const { container } = render(<Sparkline points={[7]} ariaLabel="trend" />);
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    expect(poly!.getAttribute("points")!.trim().split(/\s+/)).toHaveLength(1);
  });

  it("renders nothing drawable for an empty series but stays mounted", () => {
    const { container } = render(<Sparkline points={[]} ariaLabel="trend" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("polyline")).toBeNull();
  });
});
