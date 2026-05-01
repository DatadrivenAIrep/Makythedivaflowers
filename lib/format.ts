import type { Locale } from "@/types/locale";

type AddressLike = {
  line1: string;
  locality: string;
  region: string;
  postal?: string;
};

/**
 * One-line address composed from `SITE.address` (or any address-like value).
 * Example: "1077 Hempstead Turnpike, Franklin Square, NY 11010".
 */
export function formatAddressLine(addr: AddressLike): string {
  const tail = [addr.region, addr.postal].filter(Boolean).join(" ");
  return [addr.line1, addr.locality, tail].filter(Boolean).join(", ");
}

export function formatMoneyCents(cents: number, locale: Locale): string {
  const value = cents / 100;
  const isWhole = cents % 100 === 0;
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
  return fmt.format(value);
}

export function formatPhoneUS(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export type DeliveryWindow = {
  date: string;
  slot: "morning" | "midday" | "afternoon" | "evening";
};

const SLOT_HOURS: Record<DeliveryWindow["slot"], { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  midday: { start: 11, end: 14 },
  afternoon: { start: 13, end: 17 },
  evening: { start: 17, end: 20 },
};

export function formatDeliveryWindow(w: DeliveryWindow, locale: Locale): string {
  const range = SLOT_HOURS[w.slot];
  const date = new Date(w.date + "T00:00:00");
  const dateStr = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const fmtTime = (h: number) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(2000, 0, 1, h));
  return `${dateStr} · ${fmtTime(range.start)} – ${fmtTime(range.end)}`;
}
