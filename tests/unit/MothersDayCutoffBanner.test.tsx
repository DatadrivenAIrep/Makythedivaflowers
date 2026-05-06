import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MothersDayCutoffBanner } from "@/components/mothers-day/MothersDayCutoffBanner";

vi.mock("@/lib/conversion/use-cutoff", () => ({
  useCutoff: () => ({ status: "before", minutesRemaining: 240, cutoff: "14:00" }),
}));

describe("MothersDayCutoffBanner", () => {
  it("renders cutoff text and a countdown when before cutoff", () => {
    render(<MothersDayCutoffBanner cutoff="14:00" label="Order by Sat 2 PM" />);
    expect(screen.getByText(/Order by Sat 2 PM/i)).toBeInTheDocument();
    expect(screen.getByTestId("md-countdown")).toBeInTheDocument();
  });
});
