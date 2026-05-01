import { describe, it, expect } from "vitest";
import { isSameDayEligible, listAvailableDates, isPastDate } from "@/lib/delivery";

const CUTOFF = "14:00";

describe("delivery", () => {
  it("isSameDayEligible: true before cutoff", () => {
    const now = new Date("2026-05-01T12:30:00");
    expect(isSameDayEligible(now, CUTOFF)).toBe(true);
  });

  it("isSameDayEligible: false at or after cutoff", () => {
    expect(isSameDayEligible(new Date("2026-05-01T14:00:00"), CUTOFF)).toBe(false);
    expect(isSameDayEligible(new Date("2026-05-01T16:30:00"), CUTOFF)).toBe(false);
  });

  it("isPastDate: yesterday is past, today is not", () => {
    const today = new Date("2026-05-01T10:00:00");
    expect(isPastDate("2026-04-30", today)).toBe(true);
    expect(isPastDate("2026-05-01", today)).toBe(false);
    expect(isPastDate("2026-05-02", today)).toBe(false);
  });

  it("listAvailableDates: returns 14 ISO dates starting today when same-day eligible", () => {
    const now = new Date("2026-05-01T10:00:00");
    const dates = listAvailableDates(now, CUTOFF, 14);
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-05-01");
    expect(dates[13]).toBe("2026-05-14");
  });

  it("listAvailableDates: starts tomorrow after cutoff", () => {
    const now = new Date("2026-05-01T15:00:00");
    const dates = listAvailableDates(now, CUTOFF, 14);
    expect(dates[0]).toBe("2026-05-02");
    expect(dates).toHaveLength(14);
  });
});
