// Pure calendar math for CRM important dates. No DB, no server-only — client
// components import these helpers directly. All day math is on a UTC
// calendar-day basis (consistent with customerStats' month boundary).

export type DateKind = "birthday" | "anniversary" | "custom";
export type PreferenceKind = "favorite_flower" | "favorite_color" | "dislike";

export const DATE_KINDS: readonly DateKind[] = ["birthday", "anniversary", "custom"];
export const PREFERENCE_KINDS: readonly PreferenceKind[] = [
  "favorite_flower",
  "favorite_color",
  "dislike",
];

// Max day per month; February allows 29 (leap handling happens at occurrence time).
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export type NextOccurrence = { date: string; daysUntil: number };

/**
 * Next annual occurrence of month/day on a UTC calendar-day basis.
 * daysUntil === 0 means today. Feb 29 occurs on Feb 28 in non-leap years.
 */
export function nextOccurrence(month: number, day: number, now: Date): NextOccurrence {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startYear = now.getUTCFullYear();
  for (let year = startYear; year <= startYear + 1; year++) {
    const effDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    const candidate = Date.UTC(year, month - 1, effDay);
    if (candidate >= todayUtc) {
      return {
        date: new Date(candidate).toISOString().slice(0, 10),
        daysUntil: Math.round((candidate - todayUtc) / DAY_MS),
      };
    }
  }
  /* istanbul ignore next -- next year's occurrence is always >= today */
  throw new Error("nextOccurrence: unreachable");
}

/** "15 mar" / "Mar 15" — formats from integers with timeZone:"UTC" so the
 * rendered day never drifts across the viewer's local midnight. */
export function formatMonthDay(month: number, day: number, locale: string): string {
  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}
