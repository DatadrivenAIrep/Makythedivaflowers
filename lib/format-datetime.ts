function intlLocale(locale: string): string { return locale === "es" ? "es-ES" : "en-US"; }
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), { dateStyle: "medium" });
}
