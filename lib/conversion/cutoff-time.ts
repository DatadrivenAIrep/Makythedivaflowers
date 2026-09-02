import type { useTranslations } from "next-intl";

/**
 * Renders the "2h 30m" fragment the cutoff copy interpolates as {time}.
 *
 * Shared because the three cutoff surfaces must agree: the strings declare a
 * single {time} variable, and a component that passes anything else makes
 * next-intl throw a FORMATTING_ERROR the buyer sees as broken copy on the
 * product page. Keeping one formatter is what stops that drifting back.
 */
export function renderCutoffTime(
  minutes: number,
  t: ReturnType<typeof useTranslations>,
): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
