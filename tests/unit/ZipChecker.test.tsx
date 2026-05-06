import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZipChecker } from "@/components/mothers-day/ZipChecker";

const trackPass = vi.fn();
const trackFail = vi.fn();

vi.mock("@/lib/analytics", () => ({
  trackZipCheckPass: (args: any) => trackPass(args),
  trackZipCheckFail: (args: any) => trackFail(args),
}));

describe("ZipChecker", () => {
  beforeEach(() => {
    trackPass.mockClear();
    trackFail.mockClear();
  });

  it("shows the zone name when ZIP is valid and in-zone", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "11010");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/we deliver to/i)).toBeInTheDocument();
    expect(trackPass).toHaveBeenCalledWith({ zip: "11010", zoneId: "nassau-south" });
  });

  it("shows the rejection message for an out-of-zone ZIP", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "90210");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/we don't deliver to 90210/i)).toBeInTheDocument();
    expect(trackFail).toHaveBeenCalledWith({ zip: "90210" });
  });

  it("does not fire analytics for an invalid ZIP shape", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "abc");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(trackPass).not.toHaveBeenCalled();
    expect(trackFail).not.toHaveBeenCalled();
  });
});
