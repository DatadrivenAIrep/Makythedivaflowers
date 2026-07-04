function intlLocale(locale: string): string { return locale === "es" ? "es-ES" : "en-US"; }
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), { dateStyle: "medium" });
}
/** Formats a bare "YYYY-MM-DD" without timezone drift: the stored calendar day
 * is rendered as-is (via timeZone:"UTC"), so an Eastern-time viewer never sees
 * the previous day. Use for date-only fields like event/follow-up dates. */
export function formatDateOnly(ymd: string, locale: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}
