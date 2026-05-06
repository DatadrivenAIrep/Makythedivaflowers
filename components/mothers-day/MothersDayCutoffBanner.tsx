"use client";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { trackCutoffBannerClick } from "@/lib/analytics";

type Props = {
  cutoff: string;
  label: string;
  ctaHref?: string;
  ctaLabel?: string;
};

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function MothersDayCutoffBanner({
  cutoff,
  label,
  ctaHref = "#md-edit",
  ctaLabel = "Shop now",
}: Props) {
  const snap = useCutoff(cutoff);
  return (
    <div
      role="banner"
      className="sticky top-0 z-50 w-full bg-rouge text-bone shadow-md"
      data-testid="md-cutoff-banner"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="font-medium">{label}</span>
        <span data-testid="md-countdown" className="font-mono text-xs opacity-90">
          {snap && snap.status === "before" ? formatHM(snap.minutesRemaining) : "—"}
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
