import type { Locale } from "@/types/locale";

// A single, dignified pull-quote from a family we served. Kept out of the
// Google-reviews JSON-LD (data/reviews.ts) on purpose — this is a private
// message shared with permission, not a public Google review.
const COPY = {
  eyebrow: { en: "In their words", es: "En sus palabras" },
  quote: {
    en: "They are more beautiful than I could imagine.",
    es: "Son más hermosas de lo que podía imaginar.",
  },
  attribution: { en: "Michelle B.", es: "Michelle B." },
  context: {
    en: "In memory of a loved one",
    es: "En memoria de un ser querido",
  },
} as const;

export function SympathyTestimonial({ locale }: { locale: Locale }) {
  return (
    <section className="bg-bone py-20 md:py-28">
      <figure className="mx-auto max-w-[var(--container-max)] px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
          {COPY.eyebrow[locale]}
        </p>
        <blockquote className="mt-6 max-w-4xl font-display text-3xl leading-[1.15] tracking-tight text-ink md:text-5xl md:leading-[1.1]">
          &ldquo;{COPY.quote[locale]}&rdquo;
        </blockquote>
        <figcaption className="mt-8 font-sans text-sm text-ink/70">
          <span className="text-ink">{COPY.attribution[locale]}</span>
          <span className="mx-2 text-ink/30">·</span>
          {COPY.context[locale]}
        </figcaption>
      </figure>
    </section>
  );
}
