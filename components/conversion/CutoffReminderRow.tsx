// components/conversion/CutoffReminderRow.tsx
"use client";
import { useTranslations } from "next-intl";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;
  locale: Locale;
};

export function CutoffReminderRow({ cutoff, locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useCutoff(cutoff);

  const isAfter = snap?.status === "after";
  const time = snap ? renderTime(snap.minutesRemaining, t) : "";

  return (
    <div
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap?.status ?? "loading"}
      className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {isAfter ? t("after_label") : t("before_label")}
      </span>
      <span aria-live="polite" className="text-xs text-ink/80 text-right">
        {!snap ? t("placeholder") : isAfter ? t("after_body") : t("before_body", { time })}
      </span>
    </div>
  );
}

function renderTime(minutes: number, t: ReturnType<typeof useTranslations>): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
