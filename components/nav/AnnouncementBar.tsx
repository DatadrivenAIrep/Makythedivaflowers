"use client";
import { memo, useEffect, useState } from "react";
import { SITE } from "@/data/site";
import { trackPhoneClick } from "@/lib/analytics";
import type { Locale } from "@/types/locale";

type Props = { locale: Locale };

/**
 * The always-on utility strip above the nav: what we promise today, and a phone
 * number one tap away. Every competitor in the benchmark keeps a strip like this
 * pinned; ours is the only one that states the cutoff on the home page.
 *
 * The message is time-aware and resolved in America/New_York, not the visitor's
 * timezone — a shopper in California ordering to Nassau must see the studio's
 * clock. It renders the neutral (pre-cutoff) copy on the server and corrects
 * itself after mount, so SSR and hydration never disagree.
 */
function nycHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hour = get("hour");
  return { hour: hour === 24 ? 0 : hour, minute: get("minute") };
}

// One line at every width, sharing the strip with the phone number, so each
// state carries a short form for phones and a fuller one from `sm` up. The hero
// carries the delivery zone; this only answers "can it still arrive today?".
const COPY = {
  before: {
    short: {
      en: `Same-day until ${SITE.cutoffTime}`,
      es: `Hoy hasta las ${SITE.cutoffTime}`,
    },
    full: {
      en: `Order by ${SITE.cutoffTime} for delivery today`,
      es: `Pide antes de las ${SITE.cutoffTime} y llega hoy`,
    },
  },
  after: {
    short: { en: "Delivery tomorrow", es: "Entrega mañana" },
    full: {
      en: "Same-day closed · next delivery tomorrow",
      es: "Mismo día cerrado · entrega mañana",
    },
  },
} as const;

function AnnouncementBarImpl({ locale }: Props) {
  // null until mounted: the server can't know the studio's local time relative
  // to the viewer's render, so first paint uses the pre-cutoff copy.
  const [pastCutoff, setPastCutoff] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const { hour, minute } = nycHourMinute();
      const [ch, cm] = SITE.cutoff24.split(":").map(Number);
      setPastCutoff(hour * 60 + minute >= ch * 60 + cm);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const state = pastCutoff ? COPY.after : COPY.before;

  return (
    <div className="h-9 bg-ink text-bone">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-6">
        <p
          aria-live="polite"
          className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-bone/85 sm:text-[11px] sm:tracking-[0.14em]"
        >
          <span className="sm:hidden">{state.short[locale]}</span>
          <span className="hidden sm:inline">{state.full[locale]}</span>
        </p>
        <a
          href={SITE.phoneHref}
          onClick={() => trackPhoneClick("header")}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-bone underline-offset-4 hover:underline sm:text-[11px]"
        >
          <span aria-hidden="true" className="mr-2 hidden sm:inline text-bone/60">
            {locale === "es" ? "Llámanos" : "Call us"}
          </span>
          {SITE.phoneDisplay}
        </a>
      </div>
    </div>
  );
}

export const AnnouncementBar = memo(AnnouncementBarImpl);
