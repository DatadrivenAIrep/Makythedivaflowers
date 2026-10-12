import { describe, it, expect } from "vitest";
import { weekdaySlotHeatmap, peakDay, upcomingLoad } from "@/lib/metrics/operations";
import { holidaysForYear, nextHoliday, weekRevenueUpTo } from "@/lib/metrics/holidays";
import { mo } from "./metrics-fixtures";

describe("weekdaySlotHeatmap", () => {
  it("counts live orders by delivery weekday and slot, exact times bucketed into their slot", () => {
    const h = weekdaySlotHeatmap([
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday" }), // Saturday
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday", windowTime: "16:30" }), // → afternoon
      mo({ day: "2026-10-01", windowDate: "2026-10-12", windowSlot: "morning" }), // Monday
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-01", windowDate: "2026-08-01", windowSlot: "midday" }), // outside the period
      mo({ day: "2026-10-01" }), // in-store, no window
    ], "2026-09-13", "2026-10-12");
    expect(h.total).toBe(3);
    expect(h.counts[5]).toEqual([0, 1, 1, 0]);
    expect(h.counts[0]).toEqual([1, 0, 0, 0]);
    expect(peakDay(h)).toEqual({ weekday: 5, count: 2, sharePct: 67 });
    expect(peakDay({ counts: h.counts.map((r) => r.map(() => 0)), total: 0 })).toBeNull();
  });
});

describe("upcomingLoad", () => {
  it("lists the next 14 days with their scheduled live orders", () => {
    const load = upcomingLoad([
      mo({ day: "2026-10-01", windowDate: "2026-10-12", windowSlot: "midday" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-17", windowSlot: "midday" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-17", windowSlot: "evening" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-26", windowSlot: "midday" }), // day 15: outside
      mo({ day: "2026-10-01", windowDate: "2026-10-13", windowSlot: "midday", fulfillmentStatus: "canceled" }),
    ], "2026-10-12");
    expect(load).toHaveLength(14);
    expect(load[0]).toEqual({ date: "2026-10-12", count: 1 });
    expect(load[5]).toEqual({ date: "2026-10-17", count: 2 });
    expect(load[13].date).toBe("2026-10-25");
  });
});

describe("holidays", () => {
  it("knows each flower holiday's date, including the moving ones", () => {
    expect(holidaysForYear(2026)).toEqual([
      { id: "valentines", date: "2026-02-14" },
      { id: "mothers_day", date: "2026-05-10" },
      { id: "halloween", date: "2026-10-31" },
      { id: "thanksgiving", date: "2026-11-26" },
      { id: "christmas", date: "2026-12-25" },
    ]);
    expect(holidaysForYear(2025).find((h) => h.id === "mothers_day")?.date).toBe("2025-05-11");
  });
  it("finds the next holiday within 30 days, across the new year", () => {
    expect(nextHoliday("2026-10-12")).toEqual({ id: "halloween", date: "2026-10-31", daysUntil: 19 });
    expect(nextHoliday("2026-06-01")).toBeNull();
    expect(nextHoliday("2026-12-30", 50)).toEqual({ id: "valentines", date: "2027-02-14", daysUntil: 46 });
  });
  it("sums revenue placed in the 7 days up to a date", () => {
    expect(weekRevenueUpTo([
      mo({ day: "2025-10-25", amountPaidCents: 1000 }),
      mo({ day: "2025-10-31", amountPaidCents: 2000 }),
      mo({ day: "2025-10-24", amountPaidCents: 9999 }),
    ], "2025-10-31")).toBe(3000);
  });
});
