// Calendar math for the metrics screen, always in the shop's own time zone.
// Pure (no DB, no server-only) so client components can import the types.
import { addDaysStr, shopDateStr } from "@/lib/tv-slots";

export type MetricsRange = "7d" | "30d" | "90d" | "ytd" | "all";
export const METRICS_RANGES: readonly MetricsRange[] = ["7d", "30d", "90d", "ytd", "all"];
export type Granularity = "day" | "week" | "month";

export type Period = {
  range: MetricsRange;
  /** First shop-local day (YYYY-MM-DD), inclusive; null = since the beginning. */
  start: string | null;
  end: string;
  prevStart: string | null;
  prevEnd: string | null;
  granularity: Granularity;
};

const ROLLING_DAYS: Partial<Record<MetricsRange, number>> = { "7d": 7, "30d": 30, "90d": 90 };

/** Shop-local calendar day of an ISO instant. */
export function shopDay(iso: string): string {
  return shopDateStr(new Date(iso));
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function shiftYears(ymd: string, years: number): string {
  const y = Number(ymd.slice(0, 4)) + years;
  const md = ymd.slice(5);
  return md === "02-29" && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`;
}

export function resolvePeriod(range: MetricsRange, today: string): Period {
  const span = ROLLING_DAYS[range];
  if (span) {
    const start = addDaysStr(today, -(span - 1));
    return {
      range, start, end: today,
      prevStart: addDaysStr(start, -span), prevEnd: addDaysStr(start, -1),
      granularity: span === 90 ? "week" : "day",
    };
  }
  if (range === "ytd") {
    const start = `${today.slice(0, 4)}-01-01`;
    return { range, start, end: today, prevStart: shiftYears(start, -1), prevEnd: shiftYears(today, -1), granularity: "month" };
  }
  return { range, start: null, end: today, prevStart: null, prevEnd: null, granularity: "month" };
}

export function inPeriod(day: string, start: string | null, end: string): boolean {
  return (start === null || day >= start) && day <= end;
}

export function bucketKey(day: string, g: Granularity): string {
  if (g === "day") return day;
  if (g === "month") return day.slice(0, 7);
  const mondayOffset = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysStr(day, -mondayOffset);
}

function addMonths(ym: string, n: number): string {
  const d = new Date(`${ym}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Every bucket of the period, oldest first. "Todo" shows the last 12 months. */
export function bucketKeys(p: Period): string[] {
  const keys: string[] = [];
  if (p.granularity === "month") {
    const last = p.end.slice(0, 7);
    let cur = p.start ? p.start.slice(0, 7) : addMonths(last, -11);
    while (cur <= last) {
      keys.push(cur);
      cur = addMonths(cur, 1);
    }
    return keys;
  }
  const step = p.granularity === "week" ? 7 : 1;
  const last = bucketKey(p.end, p.granularity);
  for (let k = bucketKey(p.start as string, p.granularity); k <= last; k = addDaysStr(k, step)) keys.push(k);
  return keys;
}

export type Delta = { kind: "pct"; pct: number } | { kind: "new" } | { kind: "none" };

export function delta(cur: number, prev: number | null): Delta {
  if (prev === null) return { kind: "none" };
  if (prev === 0) return cur > 0 ? { kind: "new" } : { kind: "none" };
  return { kind: "pct", pct: Math.round(((cur - prev) / prev) * 100) };
}
