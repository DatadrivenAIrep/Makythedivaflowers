// Operación tab: when the work happens (weekday × slot) and what is already booked. Pure.
import type { DeliverySlot } from "@/types/order";
import { SLOT_ORDER, addDaysStr, slotForTime } from "@/lib/tv-slots";
import { inPeriod } from "@/lib/metrics/period";
import { isLive, type MetricOrder } from "@/lib/metrics/orders";

/** counts[weekday][slot]: weekday 0 = Monday … 6 = Sunday; slots in SLOT_ORDER. */
export type Heatmap = { counts: number[][]; total: number };

function slotOf(o: MetricOrder): DeliverySlot | null {
  if (o.windowTime) return slotForTime(o.windowTime);
  return (SLOT_ORDER as string[]).includes(o.windowSlot ?? "") ? (o.windowSlot as DeliverySlot) : null;
}

function weekdayOf(ymd: string): number {
  return (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Deliveries and pickups whose scheduled day falls inside [start, end]. */
export function weekdaySlotHeatmap(orders: MetricOrder[], start: string | null, end: string): Heatmap {
  const counts = Array.from({ length: 7 }, () => SLOT_ORDER.map(() => 0));
  let total = 0;
  for (const o of orders) {
    if (!isLive(o) || !o.windowDate || !inPeriod(o.windowDate, start, end)) continue;
    const slot = slotOf(o);
    if (!slot) continue;
    counts[weekdayOf(o.windowDate)][SLOT_ORDER.indexOf(slot)] += 1;
    total += 1;
  }
  return { counts, total };
}

export type PeakDay = { weekday: number; count: number; sharePct: number };

export function peakDay(h: Heatmap): PeakDay | null {
  if (h.total === 0) return null;
  let best = 0;
  let bestCount = -1;
  h.counts.forEach((row, weekday) => {
    const c = row.reduce((s, v) => s + v, 0);
    if (c > bestCount) {
      best = weekday;
      bestCount = c;
    }
  });
  return { weekday: best, count: bestCount, sharePct: Math.round((bestCount / h.total) * 100) };
}

export type DayLoad = { date: string; count: number };

/** Live orders already scheduled for each of the next `days` days, starting today. */
export function upcomingLoad(orders: MetricOrder[], today: string, days = 14): DayLoad[] {
  const load: DayLoad[] = Array.from({ length: days }, (_, i) => ({ date: addDaysStr(today, i), count: 0 }));
  const index = new Map(load.map((d, i) => [d.date, i]));
  for (const o of orders) {
    if (!isLive(o) || !o.windowDate) continue;
    const i = index.get(o.windowDate);
    if (i !== undefined) load[i].count += 1;
  }
  return load;
}
