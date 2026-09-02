import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/types/product";
import { OCCASIONS_ALL, OCCASION_CONTENT, getOccasionContent } from "@/data/occasion-content";
import { PRODUCTS } from "@/data/products";
import { filterProducts, sortProducts } from "@/data/product-helpers";
import { getAllImageOverrides, applyImageOverrides } from "@/lib/product-images";
import { getAllPriceOverrides, applyPriceOverrides } from "@/lib/product-prices";
import { LOCAL_CITIES } from "@/data/local-seo";
import { SITE } from "@/data/site";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { OccasionFaqLD } from "@/components/seo/OccasionFaqLD";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/motion/Reveal";
import { Grain } from "@/components/brand/Grain";
import { CutoffPill } from "@/components/conversion/CutoffPill";
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";

/** Sympathy keeps its own dedicated page; it is not funnelled through here. */
const ROUTED_ELSEWHERE = new Set<Occasion>(["sympathy"]);

/** The occasions that render here; used for the cross-links at the foot. */
const SLUGS = OCCASIONS_ALL.filter((o) => !ROUTED_ELSEWHERE.has(o));

export function generateStaticParams() {
  // Sympathy is excluded: next.config redirects /ocasiones/sympathy to the
  // dedicated /sympathy page before this route is ever reached.
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = getOccasionContent(slug);
  if (!content || ROUTED_ELSEWHERE.has(slug as Occasion)) return {};
  const es = locale === "es";
  return {
    title: es
      ? `${content.label.es} en Long Island | Entrega el Mismo Día | Diva Flowers`
      : `${content.label.en} on Long Island | Same-Day Delivery | Diva Flowers`,
    description: content.lead[locale],
    alternates: localeAlternates(locale, `/ocasiones/${slug}`),
  };
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const content = getOccasionContent(slug);
  if (!content) notFound();
  setRequestLocale(locale);
  const es = locale === "es";

  const catalog = applyImageOverrides(
    applyPriceOverrides(PRODUCTS, getAllPriceOverrides()),
    getAllImageOverrides(),
  );
  // Staff picks first: on a page someone landed on with an intent, the useful
  // ordering is "what we would hand you", not "what is newest".
  const products = sortProducts(
    filterProducts(catalog, { occasion: slug as Occasion }),
    "staff-pick",
  ).slice(0, 12);

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: es ? "Ocasiones" : "Occasions", href: `/${locale}/ocasiones` },
          { name: content.label[locale], href: `/${locale}/ocasiones/${slug}` },
        ]}
      />
      <OccasionFaqLD locale={locale} content={content} />
      <Grain />

      <header className="relative isolate overflow-hidden bg-ink text-bone">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.10),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-16 md:pt-32 md:pb-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70">
            {content.eyebrow[locale]}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[0.98] tracking-tighter md:text-6xl">
            {content.label[locale]}
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-bone/80 md:text-lg">
            {content.lead[locale]}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={`/${locale}/shop?occasion=${slug}`}
              className="inline-flex items-center rounded-full bg-bone px-6 py-3 font-sans text-sm font-medium text-ink transition hover:opacity-90"
            >
              {es ? "Ver todo" : "See everything"}
            </Link>
            <a
              href={SITE.phoneHref}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone/75 underline-offset-4 hover:text-bone hover:underline"
            >
              {es ? `O llama al ${SITE.phoneDisplay}` : `Or call ${SITE.phoneDisplay}`}
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pt-16 md:pt-20">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-3xl leading-none tracking-tighter md:text-4xl">
            {es ? "Nuestra selección" : "Our picks"}
          </h2>
          <CutoffPill cutoff={SITE.cutoff24} locale={locale} />
        </div>
        <ProductGrid products={products} locale={locale} />
      </section>

      <section className="border-t border-ink/10 bg-bone">
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            {content.guidance.map((g, i) => (
              <Reveal key={g.heading.en} delay={i * 0.06}>
                <article className="max-w-xl">
                  <h3 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                    {g.heading[locale]}
                  </h3>
                  <p className="mt-4 font-sans text-base leading-relaxed text-ink/75">
                    {g.body[locale]}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10">
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-16">
          <GiftAssuranceBar size="md" surface="home" locale={locale} />
        </div>
      </section>

      <section className="border-t border-ink/10">
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
          <Reveal>
            <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
              {es ? "Preguntas frecuentes" : "Common questions"}
            </h2>
            <dl className="mt-10 grid gap-8 md:grid-cols-2 md:gap-x-16">
              {content.faq.map((f) => (
                <div key={f.q.en} className="max-w-xl">
                  <dt className="font-sans text-base font-medium text-ink">{f.q[locale]}</dt>
                  <dd className="mt-2 font-sans text-base leading-relaxed text-ink/70">
                    {f.a[locale]}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <nav
        aria-label={es ? "Otras ocasiones y pueblos" : "Other occasions and towns"}
        className="border-t border-ink/10 bg-mute-100/40"
      >
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {es ? "Otras ocasiones" : "Other occasions"}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {SLUGS.filter((o) => o !== slug).map((o) => (
              <li key={o}>
                <Link
                  href={`/${locale}/ocasiones/${o}`}
                  className="font-sans text-sm text-ink/75 underline-offset-4 hover:text-ink hover:underline"
                >
                  {OCCASION_CONTENT[o].label[locale]}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {es ? "Entregamos en" : "We deliver to"}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {LOCAL_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${locale}/flower-delivery/${c.slug}`}
                  className="font-sans text-sm text-ink/75 underline-offset-4 hover:text-ink hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </main>
  );
}
