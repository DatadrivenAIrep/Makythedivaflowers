import { describe, it, expect } from "vitest";
import { nextOccurrence, isValidMonthDay, formatMonthDay } from "@/lib/customer-dates";

// 2026 and 2027 are non-leap; 2028 is leap.
const NOW = new Date("2026-07-04T12:00:00Z");

describe("nextOccurrence", () => {
  it("today → daysUntil 0 with today's date", () => {
    expect(nextOccurrence(7, 4, NOW)).toEqual({ date: "2026-07-04", daysUntil: 0 });
  });

  it("tomorrow → 1", () => {
    expect(nextOccurrence(7, 5, NOW)).toEqual({ date: "2026-07-05", daysUntil: 1 });
  });

  it("already passed this year → next year", () => {
    expect(nextOccurrence(7, 3, NOW)).toEqual({ date: "2027-07-03", daysUntil: 364 });
  });

  it("Dec→Jan year rollover", () => {
    const dec31 = new Date("2026-12-31T23:00:00Z");
    expect(nextOccurrence(1, 1, dec31)).toEqual({ date: "2027-01-01", daysUntil: 1 });
  });

  it("Feb 29 in a leap year occurs on Feb 29", () => {
    const now = new Date("2028-02-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now)).toEqual({ date: "2028-02-29", daysUntil: 28 });
  });

  it("Feb 29 in a non-leap year maps to Feb 28", () => {
    const now = new Date("2027-02-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now)).toEqual({ date: "2027-02-28", daysUntil: 27 });
  });

  it("Feb 29 already passed in a non-leap year → next leap year's Feb 29", () => {
    const now = new Date("2027-03-01T00:00:00Z");
    expect(nextOccurrence(2, 29, now).date).toBe("2028-02-29");
  });
});

describe("isValidMonthDay", () => {
  it("accepts real month/day combos including Feb 29", () => {
    expect(isValidMonthDay(6, 15)).toBe(true);
    expect(isValidMonthDay(2, 29)).toBe(true);
    expect(isValidMonthDay(12, 31)).toBe(true);
  });

  it("rejects impossible combos and non-integers", () => {
    expect(isValidMonthDay(2, 30)).toBe(false);
    expect(isValidMonthDay(4, 31)).toBe(false);
    expect(isValidMonthDay(13, 1)).toBe(false);
    expect(isValidMonthDay(0, 5)).toBe(false);
    expect(isValidMonthDay(1.5, 3)).toBe(false);
    expect(isValidMonthDay(6, 0)).toBe(false);
  });
});

describe("formatMonthDay", () => {
  it("formats month/day in the requested locale without timezone drift", () => {
    expect(formatMonthDay(3, 15, "es")).toContain("15");
    expect(formatMonthDay(3, 15, "es").toLowerCase()).toContain("mar");
    expect(formatMonthDay(3, 15, "en")).toContain("15");
    expect(formatMonthDay(3, 15, "en")).toContain("Mar");
  });
});
