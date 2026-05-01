import { describe, it, expect } from "vitest";
import { isSameDayEligible, listAvailableDates, isPastDate, toIsoDate, parseCutoff } from "@/lib/delivery";

const CUTOFF = "14:00";

describe("toIsoDate", () => {
  it("formats single-digit month and day with zero-padding", () => {
    expect(toIsoDate(new Date("2026-01-07T10:00:00"))).toBe("2026-01-07");
  });

  it("formats double-digit month and day", () => {
    expect(toIsoDate(new Date("2026-12-31T23:59:59"))).toBe("2026-12-31");
  });
});

describe("parseCutoff", () => {
  it("parses HH:MM into hour and minute", () => {
    expect(parseCutoff("14:00")).toEqual({ hour: 14, minute: 0 });
    expect(parseCutoff("09:30")).toEqual({ hour: 9, minute: 30 });
  });

  it("defaults minute to 0 when missing", () => {
    expect(parseCutoff("14")).toEqual({ hour: 14, minute: 0 });
  });
});

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
