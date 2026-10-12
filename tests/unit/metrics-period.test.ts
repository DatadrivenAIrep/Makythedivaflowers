// tests/unit/metrics-period.test.ts
import { describe, it, expect } from "vitest";
import {
  resolvePeriod, shopDay, shiftYears, inPeriod, bucketKey, bucketKeys, delta,
} from "@/lib/metrics/period";

const TODAY = "2026-10-12"; // a Monday

describe("resolvePeriod", () => {
  it("rolling ranges end today and compare with the same length before", () => {
    expect(resolvePeriod("7d", TODAY)).toEqual({
      range: "7d", start: "2026-10-06", end: TODAY, prevStart: "2026-09-29", prevEnd: "2026-10-05", granularity: "day",
    });
    expect(resolvePeriod("30d", TODAY)).toMatchObject({ start: "2026-09-13", prevStart: "2026-08-14", prevEnd: "2026-09-12", granularity: "day" });
    expect(resolvePeriod("90d", TODAY)).toMatchObject({ start: "2026-07-15", granularity: "week" });
  });
  it("year to date compares with the same span last year", () => {
    expect(resolvePeriod("ytd", TODAY)).toEqual({
      range: "ytd", start: "2026-01-01", end: TODAY, prevStart: "2025-01-01", prevEnd: "2025-10-12", granularity: "month",
    });
  });
  it("all time has no start and no previous period", () => {
    expect(resolvePeriod("all", TODAY)).toEqual({
      range: "all", start: null, end: TODAY, prevStart: null, prevEnd: null, granularity: "month",
    });
  });
});

describe("shopDay", () => {
  it("uses New York time: 9:30 pm EDT is still the same day", () => {
    expect(shopDay("2026-10-13T01:30:00.000Z")).toBe("2026-10-12");
    expect(shopDay("2026-10-12T15:00:00.000Z")).toBe("2026-10-12");
  });
});

describe("shiftYears", () => {
  it("moves a date by whole years and folds Feb 29", () => {
    expect(shiftYears("2026-10-12", -1)).toBe("2025-10-12");
    expect(shiftYears("2028-02-29", -1)).toBe("2027-02-28");
  });
});

describe("inPeriod", () => {
  it("is inclusive and treats a null start as open", () => {
    expect(inPeriod("2026-09-13", "2026-09-13", TODAY)).toBe(true);
    expect(inPeriod("2026-09-12", "2026-09-13", TODAY)).toBe(false);
    expect(inPeriod("2019-01-01", null, TODAY)).toBe(true);
    expect(inPeriod("2026-10-13", null, TODAY)).toBe(false);
  });
});

describe("buckets", () => {
  it("keys days, Monday-starting weeks and months", () => {
    expect(bucketKey("2026-10-14", "day")).toBe("2026-10-14");
    expect(bucketKey("2026-10-14", "week")).toBe("2026-10-12");
    expect(bucketKey("2026-10-18", "week")).toBe("2026-10-12"); // Sunday belongs to the week that started Monday
    expect(bucketKey("2026-10-14", "month")).toBe("2026-10");
  });
  it("lists every bucket of the period, oldest first", () => {
    expect(bucketKeys(resolvePeriod("7d", TODAY))).toEqual([
      "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12",
    ]);
    expect(bucketKeys(resolvePeriod("ytd", TODAY))).toHaveLength(10);
    const all = bucketKeys(resolvePeriod("all", TODAY));
    expect(all).toHaveLength(12);
    expect(all[0]).toBe("2025-11");
    expect(all[11]).toBe("2026-10");
    const weeks = bucketKeys(resolvePeriod("90d", TODAY));
    expect(weeks[0]).toBe("2026-07-13");
    expect(weeks[weeks.length - 1]).toBe("2026-10-12");
  });
});

describe("delta", () => {
  it("is a rounded percent, 'new' from zero, and 'none' with no comparison", () => {
    expect(delta(118, 100)).toEqual({ kind: "pct", pct: 18 });
    expect(delta(80, 100)).toEqual({ kind: "pct", pct: -20 });
    expect(delta(5, 0)).toEqual({ kind: "new" });
    expect(delta(0, 0)).toEqual({ kind: "none" });
    expect(delta(5, null)).toEqual({ kind: "none" });
  });
});
