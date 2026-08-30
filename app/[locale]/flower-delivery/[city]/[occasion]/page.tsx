import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { LOCAL_CITIES, LOCAL_OCCASIONS, getCity, getOccasion } from "@/data/local-seo";
import { SITE } from "@/data/site";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { LocalServiceLD } from "@/components/seo/LocalServiceLD";
import { LocalHero } from "@/components/local/LocalHero";
import { LocalDeliveryNote } from "@/components/local/LocalDeliveryNote";
import { LocalGuidance } from "@/components/local/LocalGuidance";
import { LocalIntersection } from "@/components/local/LocalIntersection";
import { LocalFaq } from "@/components/local/LocalFaq";
import { LocalLinks } from "@/components/local/LocalLinks";
import { Grain } from "@/components/brand/Grain";

export function generateStaticParams() {
  return LOCAL_CITIES.flatMap((c) =>
    LOCAL_OCCASIONS.map((o) => ({ city: c.slug, occasion: o.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; city: string; occasion: string }>;
}): Promise<Metadata> {
  const { locale, city: citySlug, occasion: occSlug } = await params;
  const city = getCity(citySlug);
  const occasion = getOccasion(occSlug);
  if (!city || !occasion) return {};
  const es = locale === "es";
  return {
    title: es
      ? `${occasion.label.es} en ${city.name}, NY | Diva Flowers`
      : `${occasion.label.en} in ${city.name}, NY | Diva Flowers`,
    description: es
      ? `${occasion.leadIn.es} Entregamos en ${city.name} (${city.zips.join(", ")}) y alrededores, a ${city.driveMinutes} minutos del taller.`
      : `${occasion.leadIn.en} Delivered in ${city.name} (${city.zips.join(", ")}) and the surrounding villages, ${city.driveMinutes} minutes from the studio.`,
    alternates: localeAlternates(locale, `/flower-delivery/${citySlug}/${occSlug}`),
  };
}

export default async function CityOccasionPage({
  params,
}: {
  params: Promise<{ locale: Locale; city: string; occasion: string }>;
}) {
  const { locale, city: citySlug, occasion: occSlug } = await params;
  const city = getCity(citySlug);
  const occasion = getOccasion(occSlug);
  if (!city || !occasion) notFound();
  setRequestLocale(locale);
  const es = locale === "es";

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: es ? "Entrega de flores" : "Flower delivery", href: `/${locale}/flower-delivery` },
          { name: `${city.name}, NY`, href: `/${locale}/flower-delivery/${city.slug}` },
          {
            name: occasion.label[locale],
            href: `/${locale}/flower-delivery/${city.slug}/${occasion.slug}`,
          },
        ]}
      />
      <LocalServiceLD locale={locale} city={city} occasion={occasion} />
      <Grain />
      <LocalHero
        locale={locale}
        city={city}
        eyebrow={`${city.name}, NY · ${occasion.label[locale]}`}
        heading={
          es
            ? `${occasion.label.es} en ${city.name}, NY`
            : `${occasion.label.en} in ${city.name}, NY`
        }
        body={occasion.leadIn[locale]}
      />
      <LocalIntersection locale={locale} city={city} occasion={occasion} />
      <LocalGuidance locale={locale} occasion={occasion} />
      <LocalDeliveryNote locale={locale} city={city} />
      <LocalFaq locale={locale} city={city} occasion={occasion} />

      <section className="border-t border-ink/10">
        <div className="mx-auto max-w-[var(--container-max)] px-6 py-16 text-center">
          <Link
            href={`/${locale}${occasion.shopHref}`}
            className="inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 font-sans text-base font-medium text-bone transition-[transform,opacity] [transition-duration:var(--motion-fast)] hover:opacity-90 active:scale-[0.97]"
          >
            {es
              ? `Ver ${occasion.label.es.toLowerCase()}`
              : `See ${occasion.label.en.toLowerCase()}`}
          </Link>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-mute-500">
            {es
              ? `O llama al ${SITE.phoneDisplay} · límite ${SITE.cutoffTime}`
              : `Or call ${SITE.phoneDisplay} · ${SITE.cutoffTime} cutoff`}
          </p>
        </div>
      </section>

      <LocalLinks locale={locale} city={city} currentOccasion={occasion.slug} />
    </main>
  );
}
