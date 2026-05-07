import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MothersDayCutoffBanner } from "@/components/mothers-day/MothersDayCutoffBanner";

vi.mock("@/lib/conversion/use-cutoff", () => ({
  useCutoff: () => ({ status: "before", minutesRemaining: 240, cutoff: "14:00" }),
}));

describe("MothersDayCutoffBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders cutoff text and a daily countdown when before cutoff", () => {
    render(<MothersDayCutoffBanner cutoff="14:00" label="Order by Sat 2 PM" />);
    expect(screen.getByText(/Order by Sat 2 PM/i)).toBeInTheDocument();
    expect(screen.getByTestId("md-countdown")).toBeInTheDocument();
  });

  it("uses deadlineAt when provided and renders a multi-day countdown", () => {
    // Pretend it's 2026-05-08T18:00:00-04:00 (Friday 6 PM ET) — exactly 2 days before Sun 6 PM
    vi.setSystemTime(new Date("2026-05-08T22:00:00.000Z"));
    render(
      <MothersDayCutoffBanner
        cutoff="14:00"
        deadlineAt="2026-05-10T18:00:00-04:00"
        label="Order by Sun May 10 · 6 PM"
      />,
    );
    expect(screen.getByText(/Order by Sun May 10/i)).toBeInTheDocument();
    expect(screen.getByTestId("md-countdown")).toHaveTextContent(/2d 0h/);
  });

  it("renders an em-dash when the fixed deadline has passed", () => {
    vi.setSystemTime(new Date("2026-05-11T00:00:00.000Z"));
    render(
      <MothersDayCutoffBanner
        cutoff="14:00"
        deadlineAt="2026-05-10T18:00:00-04:00"
        label="MD"
      />,
    );
    expect(screen.getByTestId("md-countdown")).toHaveTextContent("—");
  });
});
