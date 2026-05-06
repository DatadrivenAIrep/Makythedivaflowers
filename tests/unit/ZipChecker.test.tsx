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

  it("shows the city name and fixed price for a named city ZIP", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "11507");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/delivery to albertson/i)).toBeInTheDocument();
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(trackPass).toHaveBeenCalledWith({ zip: "11507", zoneId: "albertson" });
  });

  it("shows a price range for ZIPs in the further zone", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "11530");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/\$25–\$30/)).toBeInTheDocument();
    expect(trackPass).toHaveBeenCalledWith({ zip: "11530", zoneId: "further" });
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
