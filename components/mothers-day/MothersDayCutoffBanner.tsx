"use client";
import { useEffect, useState } from "react";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { trackCutoffBannerClick } from "@/lib/analytics";

type Props = {
  /** Daily cutoff in HH:MM format. Used when `deadlineAt` is absent. */
  cutoff: string;
  /** Optional ISO datetime that overrides the daily cutoff for a single fixed deadline (e.g. Mother's Day Sunday 6 PM). */
  deadlineAt?: string;
  label: string;
  ctaHref?: string;
  ctaLabel?: string;
};

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatDHM(minutes: number): string {
  const days = Math.floor(minutes / (60 * 24));
  const hoursLeft = Math.floor((minutes % (60 * 24)) / 60);
  const m = minutes % 60;
  if (days > 0) return `${days}d ${hoursLeft}h`;
  return `${hoursLeft}h ${m.toString().padStart(2, "0")}m`;
}

function useDeadlineMinutes(deadlineAt: string | undefined): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineAt) return;
    const tick = () => {
      const diff = Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 60000);
      setMinutes(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [deadlineAt]);
  return minutes;
}

export function MothersDayCutoffBanner({
  cutoff,
  deadlineAt,
  label,
  ctaHref = "#md-edit",
  ctaLabel = "Shop now",
}: Props) {
  const snap = useCutoff(cutoff);
  const deadlineMin = useDeadlineMinutes(deadlineAt);

  let countdown = "—";
  if (deadlineAt) {
    if (deadlineMin !== null && deadlineMin > 0) {
      countdown = formatDHM(deadlineMin);
    }
  } else if (snap && snap.status === "before") {
    countdown = formatHM(snap.minutesRemaining);
  }

  return (
    <div
      role="region"
      aria-label="Order cutoff"
      className="sticky top-0 z-50 w-full bg-rouge text-bone shadow-md"
      data-testid="md-cutoff-banner"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="font-medium">{label}</span>
        <span data-testid="md-countdown" className="font-mono text-xs opacity-90">
          {countdown}
        </span>
        <a
          href={ctaHref}
          onClick={trackCutoffBannerClick}
          className="rounded-full bg-bone px-3 py-1 text-xs font-semibold text-rouge hover:bg-bone/90"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
