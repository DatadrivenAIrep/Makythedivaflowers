// components/conversion/CutoffPill.tsx
"use client";
import { useTranslations } from "next-intl";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;
  locale: Locale;
};

export function CutoffPill({ cutoff, locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useCutoff(cutoff);
  if (!snap) return null;

  const isAfter = snap.status === "after";
  const time = renderTime(snap.minutesRemaining, t);

  return (
    <span
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap.status}
      className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-bone/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/85"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rouge" />
      {isAfter ? t("after_label") : t("before_body", { time })}
    </span>
  );
}

function renderTime(minutes: number, t: ReturnType<typeof useTranslations>): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
