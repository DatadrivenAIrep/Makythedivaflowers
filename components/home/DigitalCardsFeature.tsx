import Link from "next/link";
import type { Locale } from "@/types/locale";
import { DIGITAL_CARDS_PAGE as P } from "@/data/digital-cards";
import { DEMOS_URL } from "@/lib/digital-card-offer";
import { PromoLoop } from "@/components/digital-cards/PromoVideo";

/**
 * The digital card on the homepage: the 10 s promo looping beside what it is,
 * with the way to the page that explains it and to the live demos. A dark panel
 * on the bone page, the film's own black, so the loop sits in it without an edge.
 */
export function DigitalCardsFeature({ locale }: { locale: Locale }) {
  const [line1, line2] = P.title[locale];
  return (
    <section aria-labelledby="digital-cards-home" className="mx-auto max-w-[var(--container-max)] px-6 py-14 md:py-16">
      <div className="grid items-center overflow-hidden rounded-[var(--radius-bento)] bg-ink text-bone md:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <div className="flex flex-col gap-6 p-8 md:p-12 lg:p-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-petal">{P.eyebrow[locale]}</p>
          <h2 id="digital-cards-home" className="font-display text-4xl leading-[0.98] tracking-[-0.02em] md:text-5xl lg:text-6xl">
            {line1}
            <br />
            <em className="font-light italic">{line2}</em>
          </h2>
          <p className="max-w-md text-base leading-relaxed text-bone/75">{P.lead[locale]}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/digital-cards`}
              className="inline-block rounded-full bg-bone px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-bone/90"
            >
              {P.stepsTitle[locale]}
            </Link>
            <a
              href={DEMOS_URL}
              target="_blank"
              rel="noopener"
              className="inline-block rounded-full border border-bone/30 px-6 py-3 text-sm font-medium text-bone transition-colors hover:bg-bone/10"
            >
              {P.ctaDemos[locale]} ↗
            </a>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/55">{P.price[locale]}</p>
        </div>
        <div className="relative aspect-[9/16] md:aspect-video">
          <PromoLoop locale={locale} className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </div>
    </section>
  );
}
