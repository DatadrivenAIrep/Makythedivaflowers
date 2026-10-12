// The flower holidays the insights warn about, and last year's sales the week before each. Pure.
import { addDaysStr, dayDiff } from "@/lib/tv-slots";
import { revenueOf, type MetricOrder } from "@/lib/metrics/orders";

export type HolidayId = "valentines" | "mothers_day" | "halloween" | "thanksgiving" | "christmas";
export type Holiday = { id: HolidayId; date: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** The nth given weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function holidaysForYear(y: number): Holiday[] {
  return [
    { id: "valentines", date: `${y}-02-14` },
    { id: "mothers_day", date: nthWeekday(y, 5, 0, 2) },
    { id: "halloween", date: `${y}-10-31` },
    { id: "thanksgiving", date: nthWeekday(y, 11, 4, 4) },
    { id: "christmas", date: `${y}-12-25` },
  ];
}

export function nextHoliday(today: string, withinDays = 30): (Holiday & { daysUntil: number }) | null {
  const y = Number(today.slice(0, 4));
  for (const h of [...holidaysForYear(y), ...holidaysForYear(y + 1)]) {
    const daysUntil = dayDiff(today, h.date);
    if (daysUntil >= 0) return daysUntil <= withinDays ? { ...h, daysUntil } : null;
  }
  return null;
}

/** Revenue from orders placed in the 7 days ending on `date` (inclusive). */
export function weekRevenueUpTo(orders: MetricOrder[], date: string): number {
  const from = addDaysStr(date, -6);
  return orders.reduce((s, o) => (o.day >= from && o.day <= date ? s + revenueOf(o) : s), 0);
}
