// components/conversion/CutoffCountdown.tsx
"use client";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { snapshotCutoff } from "@/lib/conversion/cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import { renderCutoffTime } from "@/lib/conversion/cutoff-time";
import type { CutoffSnapshot } from "@/lib/conversion/types";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;          // "HH:MM"
  tone?: "default" | "sympathy";
  locale: Locale;
};

/**
 * Deferred cutoff hook — first paint returns null (placeholder).
 * Hydrates after a setTimeout(0) so SSR and client snapshots never mismatch.
 * Uses flushSync so test environments with fake timers see the update immediately.
 */
function useDeferredCutoff(cutoff: string): CutoffSnapshot | null {
  const [snap, setSnap] = useState<CutoffSnapshot | null>(null);
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timerId = setTimeout(() => {
      const tick = () => {
        flushSync(() => setSnap(snapshotCutoff(new Date(), cutoff)));
      };
      tick();
      intervalId = setInterval(tick, 60_000);
    }, 0);
    return () => {
      clearTimeout(timerId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [cutoff]);
  return snap;
}

export function CutoffCountdown({ cutoff, tone = "default", locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useDeferredCutoff(cutoff);

  const sym = tone === "sympathy";
  const isAfter = snap?.status === "after";

  const labelKey = isAfter ? "after_label" : sym ? "before_label_sym" : "before_label";
  const bodyKey = isAfter
    ? sym ? "after_body_sym" : "after_body"
    : sym ? "before_body_sym" : "before_body";

  // The copy declares a single {time} variable — passing {h, m} instead is a
  // FORMATTING_ERROR the buyer sees as broken text.
  const time = snap ? renderCutoffTime(snap.minutesRemaining, t) : null;

  return (
    <div
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap?.status ?? "loading"}
      className="flex flex-col gap-1 rounded-xl border border-ink/10 bg-bone/60 px-4 py-3"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {t(labelKey)}
      </p>
      <p aria-live="polite" className="text-sm text-ink/85 leading-snug">
        {!snap || time === null
          ? t("placeholder")
          : isAfter
          ? t(bodyKey)
          : t(bodyKey, { time })}
      </p>
    </div>
  );
}

