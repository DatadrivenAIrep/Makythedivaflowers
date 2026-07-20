import type { DeliverySlot } from "@/types/order";

export const SHOP_TZ = "America/New_York";

/** Confirmed slot START times, minutes since shop-local midnight. */
export const SLOT_START_MIN: Record<DeliverySlot, number> = {
  morning: 9 * 60,    // 09:00
  midday: 12 * 60,    // 12:00
  afternoon: 15 * 60, // 15:00
  evening: 18 * 60,   // 18:00
};

export const SLOT_ORDER: DeliverySlot[] = ["morning", "midday", "afternoon", "evening"];

export const SLOT_LABEL_ES: Record<DeliverySlot, string> = {
  morning: "Mañana", midday: "Mediodía", afternoon: "Tarde", evening: "Noche",
};

export const SLOT_ICON: Record<DeliverySlot, string> = {
  morning: "🌅", midday: "☀️", afternoon: "🌇", evening: "🌙",
};

export const URGENCY_RED_MIN = 60;
export const URGENCY_AMBER_MIN = 180;
export type Urgency = "red" | "amber" | "green";

export function urgencyLevel(minutesRemaining: number): Urgency {
  if (minutesRemaining <= URGENCY_RED_MIN) return "red";
  if (minutesRemaining <= URGENCY_AMBER_MIN) return "amber";
  return "green";
}

/** Shop-local calendar date (YYYY-MM-DD) for an instant. en-CA => ISO order. */
export function shopDateStr(now: Date, tz: string = SHOP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** Shop-local minutes since midnight. hourCycle h23 avoids the "24:00" quirk. */
export function shopMinutesOfDay(now: Date, tz: string = SHOP_TZ): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** Add N days to a YYYY-MM-DD string (noon-anchored UTC to dodge DST edges). */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference toDate - fromDate. */
export function dayDiff(fromDateStr: string, toDateStr: string): number {
  const a = Date.parse(fromDateStr + "T00:00:00Z");
  const b = Date.parse(toDateStr + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Minutes until a window's slot start, in shop time. Negative => overdue.
 *  Note: a countdown spanning a DST switch (twice/year) may be off by 60 min. */
export function minutesUntilSlotStart(
  now: Date, windowDate: string, slot: DeliverySlot, tz: string = SHOP_TZ,
): number {
  const today = shopDateStr(now, tz);
  const nowMin = shopMinutesOfDay(now, tz);
  return dayDiff(today, windowDate) * 24 * 60 + SLOT_START_MIN[slot] - nowMin;
}

/** "1:45", "0:05", "-1:15". */
export function formatCountdown(minutesRemaining: number): string {
  const sign = minutesRemaining < 0 ? "-" : "";
  const abs = Math.abs(minutesRemaining);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
