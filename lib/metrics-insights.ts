// "Lo que hay que saber": fixed rules over numbers the payload already has.
// No AI: same data, same sentences. The UI renders `key` with next-intl.
import type { Delta } from "@/lib/metrics/period";
import type { HolidayId } from "@/lib/metrics/holidays";
import type { ChannelId } from "@/lib/metrics/sales";

export type InsightId =
  | "pending_payments" | "upcoming_dates" | "holiday_ahead" | "at_risk"
  | "revenue_trend" | "channel_shift" | "peak_day" | "none";

export type Insight = {
  id: InsightId;
  icon: string;
  /** admin_metrics message key. */
  key: string;
  /** Numbers for the message; `amountCents` is formatted as money by the UI. */
  values: Record<string, number>;
  /** Names the UI translates itself: holiday, weekday (0 = Monday), channel. */
  refs: { holiday?: HolidayId; weekday?: number; channel?: ChannelId };
  action?: { kind: "link"; href: string } | { kind: "tab"; tab: "sales" | "operations" | "customers" };
};

export type InsightInput = {
  locale: "en" | "es";
  revenueDelta: Delta;
  pending: { count: number; cents: number };
  upcomingDates7: number;
  holiday: { id: HolidayId; daysUntil: number; lastYearCents: number } | null;
  atRiskCount: number;
  peakDay: { weekday: number; count: number; sharePct: number } | null;
  ordersInPeriod: number;
  channelShift: { channel: ChannelId; pts: number } | null;
};

const MAX = 5;
const TREND_THRESHOLD_PCT = 10;
const PEAK_MIN_ORDERS = 20;
const CHANNEL_SHIFT_PTS = 5;

export function buildInsights(input: InsightInput): Insight[] {
  const admin = `/${input.locale}/admin`;
  const out: Insight[] = [];

  // Money and near dates: what to act on today.
  if (input.pending.count > 0) {
    out.push({
      id: "pending_payments", icon: "💳", key: "insight_pending",
      values: { n: input.pending.count, amountCents: input.pending.cents }, refs: {},
      action: { kind: "link", href: `${admin}/dashboard/ledger` },
    });
  }
  if (input.upcomingDates7 > 0) {
    out.push({
      id: "upcoming_dates", icon: "🎂", key: input.upcomingDates7 === 1 ? "insight_upcoming_dates_one" : "insight_upcoming_dates",
      values: { n: input.upcomingDates7 }, refs: {}, action: { kind: "tab", tab: "customers" },
    });
  }
  if (input.holiday && input.holiday.lastYearCents > 0) {
    out.push({
      id: "holiday_ahead", icon: "📅", key: "insight_holiday",
      values: { days: input.holiday.daysUntil, amountCents: input.holiday.lastYearCents }, refs: { holiday: input.holiday.id },
    });
  }
  if (input.atRiskCount > 0) {
    out.push({
      id: "at_risk", icon: "💤", key: "insight_at_risk", values: { n: input.atRiskCount }, refs: {},
      action: { kind: "link", href: `${admin}/campaigns` },
    });
  }

  // Trends: how the period reads.
  if (input.revenueDelta.kind === "pct" && Math.abs(input.revenueDelta.pct) >= TREND_THRESHOLD_PCT) {
    const up = input.revenueDelta.pct > 0;
    out.push({
      id: "revenue_trend", icon: up ? "📈" : "📉", key: up ? "insight_revenue_up" : "insight_revenue_down",
      values: { pct: Math.abs(input.revenueDelta.pct) }, refs: {},
    });
  }
  if (input.channelShift && Math.abs(input.channelShift.pts) >= CHANNEL_SHIFT_PTS) {
    const up = input.channelShift.pts > 0;
    out.push({
      id: "channel_shift", icon: up ? "↗️" : "↘️", key: up ? "insight_channel_up" : "insight_channel_down",
      values: { pts: Math.abs(input.channelShift.pts) }, refs: { channel: input.channelShift.channel },
      action: { kind: "tab", tab: "sales" },
    });
  }
  if (input.peakDay && input.ordersInPeriod >= PEAK_MIN_ORDERS) {
    out.push({
      id: "peak_day", icon: "🗓️", key: "insight_peak_day",
      values: { pct: input.peakDay.sharePct }, refs: { weekday: input.peakDay.weekday },
      action: { kind: "tab", tab: "operations" },
    });
  }

  return out.length ? out.slice(0, MAX) : [{ id: "none", icon: "🌿", key: "insight_none", values: {}, refs: {} }];
}
