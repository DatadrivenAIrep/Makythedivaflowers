import type { ChannelId } from "@/lib/metrics/sales";
import type { Granularity } from "@/lib/metrics/period";

export function money(cents: number, compact = false): string {
  const dollars = cents / 100;
  if (compact && Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  }
  return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Fixed per channel (validated against #FAF6F0) — never by rank.
export const CHANNEL_COLOR: Record<ChannelId, string> = {
  web: "#B8345E", phone: "#1F78C8", whatsapp: "#C9850F", "walk-in": "#1E8A5E", event: "#7A4FB0",
};

const intl = (locale: string) => (locale === "es" ? "es-ES" : "en-US");

/** Axis/tooltip label for a bucket key: "12 oct" for days and weeks, "oct" for months. */
export function bucketLabel(key: string, g: Granularity, locale: string): string {
  if (g === "month") {
    return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(intl(locale), { month: "short", timeZone: "UTC" }).replace(".", "");
  }
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(intl(locale), { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}

/**
 * Whether bucket `i` gets an x-axis label: every `every`th one, plus always the last. A regular
 * label too close to the last one is dropped so the two never overlap ("11 oct12 oct").
 */
export function showAxisLabel(i: number, last: number, every: number): boolean {
  return i === last || (i % every === 0 && last - i >= Math.ceil(every / 2));
}
