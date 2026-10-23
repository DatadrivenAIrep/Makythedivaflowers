import { describe, it, expect } from "vitest";
import { buildInsights, type InsightInput } from "@/lib/metrics-insights";

const quiet: InsightInput = {
  locale: "es", revenueDelta: { kind: "pct", pct: 3 }, pending: { count: 0, cents: 0 },
  upcomingDates7: 0, holiday: null, atRiskCount: 0, peakDay: null, ordersInPeriod: 5, channelShift: null,
};

describe("buildInsights", () => {
  it("says there is nothing new when no rule fires", () => {
    expect(buildInsights(quiet)).toEqual([{ id: "none", icon: "🌿", key: "insight_none", values: {}, refs: {} }]);
  });

  it("orders money and near dates before trends and caps at five", () => {
    const out = buildInsights({
      ...quiet,
      revenueDelta: { kind: "pct", pct: 18 },
      pending: { count: 7, cents: 184000 },
      upcomingDates7: 12,
      holiday: { id: "halloween", daysUntil: 19, lastYearCents: 230000 },
      atRiskCount: 14,
      peakDay: { weekday: 5, count: 31, sharePct: 31 },
      ordersInPeriod: 96,
      channelShift: { channel: "web", pts: 6 },
    });
    expect(out.map((i) => i.id)).toEqual(["pending_payments", "upcoming_dates", "holiday_ahead", "at_risk", "revenue_trend"]);
    expect(out[0]).toEqual({
      id: "pending_payments", icon: "💳", key: "insight_pending", values: { n: 7, amountCents: 184000 }, refs: {},
      action: { kind: "link", href: "/es/admin/dashboard/ledger" },
    });
    expect(out[1].action).toEqual({ kind: "tab", tab: "customers" });
    expect(out[2]).toMatchObject({ key: "insight_holiday", values: { days: 19, amountCents: 230000 }, refs: { holiday: "halloween" } });
    expect(out[3].action).toEqual({ kind: "link", href: "/es/admin/campaigns" });
    expect(out[4]).toMatchObject({ key: "insight_revenue_up", values: { pct: 18 } });
  });

  it("reads a drop, a channel shift and a weekday peak", () => {
    const out = buildInsights({
      ...quiet,
      revenueDelta: { kind: "pct", pct: -15 },
      peakDay: { weekday: 5, count: 31, sharePct: 31 },
      ordersInPeriod: 40,
      channelShift: { channel: "phone", pts: -7 },
    });
    expect(out.map((i) => i.key)).toEqual(["insight_revenue_down", "insight_channel_down", "insight_peak_day"]);
    expect(out[0].values).toEqual({ pct: 15 });
    expect(out[1]).toMatchObject({ values: { pts: 7 }, refs: { channel: "phone" } });
    expect(out[2]).toMatchObject({ values: { pct: 31 }, refs: { weekday: 5 } });
  });

  it("skips a holiday nobody bought for last year and a peak on few orders", () => {
    const out = buildInsights({
      ...quiet,
      holiday: { id: "christmas", daysUntil: 10, lastYearCents: 0 },
      peakDay: { weekday: 5, count: 3, sharePct: 60 },
      ordersInPeriod: 5,
    });
    expect(out.map((i) => i.id)).toEqual(["none"]);
  });

  it("uses a single key for dates (ICU plural handles n = 1)", () => {
    const out = buildInsights({ ...quiet, upcomingDates7: 1 });
    expect(out[0]).toMatchObject({ id: "upcoming_dates", key: "insight_upcoming_dates", values: { n: 1 } });
  });

  it("announces a holiday that is today instead of 'in 0 days'", () => {
    const out = buildInsights({ ...quiet, holiday: { id: "halloween", daysUntil: 0, lastYearCents: 230000 } });
    expect(out[0]).toMatchObject({ id: "holiday_ahead", key: "insight_holiday_today", values: { amountCents: 230000 }, refs: { holiday: "halloween" } });
    expect(out[0].values.days).toBeUndefined();
  });
});
