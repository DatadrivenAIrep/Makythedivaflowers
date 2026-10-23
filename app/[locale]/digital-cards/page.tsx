import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { DIGITAL_CARD_MODELS, DIGITAL_CARDS_PAGE as P, demoUrl } from "@/data/digital-cards";
import { DEMOS_URL } from "@/lib/digital-card-offer";
import { PromoFilm } from "@/components/digital-cards/PromoVideo";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: P.meta.title[locale],
    description: P.meta.description[locale],
    alternates: localeAlternates(locale, "/digital-cards"),
    openGraph: {
      title: P.meta.title[locale],
      description: P.meta.description[locale],
      url: `${SITE.url}/${locale}/digital-cards`,
      images: [`/digital-cards/poster-${locale}-16x9.jpg`],
    },
  };
}

export default async function DigitalCardsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [line1, line2] = P.title[locale];
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: P.faq.map((f) => ({
      "@type": "Question",
      name: f.q[locale],
      acceptedAnswer: { "@type": "Answer", text: f.a[locale] },
    })),
  };

  return (
    <main className="bg-bone text-ink">
      {/* The promise and the film */}
      <section className="bg-ink text-bone">
        <div className="mx-auto grid max-w-[var(--container-max)] items-center gap-10 px-6 pt-32 pb-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] md:pb-24">
          <div className="flex flex-col gap-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-petal">{P.eyebrow[locale]}</p>
            <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.03em] md:text-6xl lg:text-7xl">
              {line1}
              <br />
              <em className="font-light italic">{line2}</em>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-bone/75 md:text-lg">{P.lead[locale]}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/shop`}
                className="inline-block rounded-full bg-bone px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone/90"
              >
                {P.ctaShop[locale]}
              </Link>
              <a
                href={DEMOS_URL}
                target="_blank"
                rel="noopener"
                className="inline-block rounded-full border border-bone/30 px-7 py-3.5 text-sm font-medium text-bone transition-colors hover:bg-bone/10"
              >
                {P.ctaDemos[locale]} ↗
              </a>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/55">{P.price[locale]}</p>
          </div>
          <figure className="flex flex-col gap-3">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-[var(--radius-bento)] bg-charcoal md:aspect-video md:max-w-none">
              <PromoFilm locale={locale} label={P.filmLabel[locale]} className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <figcaption className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50">
              {P.filmCaption[locale]}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="dc-steps" className="mx-auto max-w-[var(--container-max)] px-6 py-16 md:py-24">
        <h2 id="dc-steps" className="font-display text-4xl tracking-[-0.02em] md:text-5xl">{P.stepsTitle[locale]}</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {P.steps.map((s, i) => (
            <li key={i} className="flex flex-col gap-3 border-t border-ink/10 pt-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-rouge">0{i + 1}</span>
              <h3 className="font-display text-2xl">{s.title[locale]}</h3>
              <p className="text-ink/70">{s.body[locale]}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Every design, each a live demo */}
      <section aria-labelledby="dc-models" className="bg-ink text-bone">
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-16 md:py-24">
          <h2 id="dc-models" className="font-display text-4xl tracking-[-0.02em] md:text-5xl">{P.modelsTitle[locale]}</h2>
          <p className="mt-4 max-w-xl text-bone/70">{P.modelsLead[locale]}</p>
          <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {DIGITAL_CARD_MODELS.map((m) => (
              <li key={m.id}>
                <a href={demoUrl(m.id, locale)} target="_blank" rel="noopener" className="group flex flex-col gap-3">
                  <span className="relative block aspect-[9/19.5] overflow-hidden rounded-2xl border border-bone/10 bg-charcoal">
                    <img
                      src={`/digital-cards/models/${m.id}-${locale}.jpg`}
                      alt={m.name[locale]}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </span>
                  <span className="font-display text-lg leading-tight">{m.name[locale]}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/55">{m.occasion[locale]}</span>
                  <span className="text-sm text-petal underline-offset-4 group-hover:underline">{P.demoLink[locale]} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What it carries, and the questions */}
      <section className="mx-auto grid max-w-[var(--container-max)] gap-14 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h2 className="font-display text-4xl tracking-[-0.02em]">{P.includedTitle[locale]}</h2>
          <ul className="mt-8 flex flex-col">
            {P.included.map((item, i) => (
              <li key={i} className="flex items-center gap-3 border-t border-ink/10 py-4 text-lg">
                <span aria-hidden className="text-rouge">❀</span>
                {item[locale]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-4xl tracking-[-0.02em]">{P.faqTitle[locale]}</h2>
          <dl className="mt-8 flex flex-col">
            {P.faq.map((f, i) => (
              <div key={i} className="border-t border-ink/10 py-5">
                <dt className="font-display text-xl">{f.q[locale]}</dt>
                <dd className="mt-2 text-ink/70">{f.a[locale]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
        <div className="flex flex-col items-start gap-6 rounded-[var(--radius-bento)] bg-ink p-10 text-bone md:flex-row md:items-center md:justify-between md:p-14">
          <h2 className="font-display text-3xl tracking-[-0.02em] md:text-4xl">{P.closingTitle[locale]}</h2>
          <Link
            href={`/${locale}/shop`}
            className="inline-block rounded-full bg-bone px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-bone/90"
          >
            {P.ctaShop[locale]}
          </Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </main>
  );
}
