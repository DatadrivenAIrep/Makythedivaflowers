import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { LOCAL_CITIES, getCity } from "@/data/local-seo";
import { SITE } from "@/data/site";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { LocalServiceLD } from "@/components/seo/LocalServiceLD";
import { LocalHero } from "@/components/local/LocalHero";
import { LocalDeliveryNote } from "@/components/local/LocalDeliveryNote";
import { LocalFaq } from "@/components/local/LocalFaq";
import { LocalLinks } from "@/components/local/LocalLinks";
import { Grain } from "@/components/brand/Grain";

export function generateStaticParams() {
  return LOCAL_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; city: string }>;
}): Promise<Metadata> {
  const { locale, city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const es = locale === "es";
  return {
    title: es
      ? `Floristería en ${city.name}, NY | Flores a Domicilio el Mismo Día | Diva Flowers`
      : `${city.name} NY Florist | Same-Day Flower Delivery | Diva Flowers`,
    description: es
      ? `Entrega de flores el mismo día en ${city.name}, NY (${city.zips.join(", ")}). Floristería local a ${city.driveMinutes} minutos — bodas, condolencias, cumpleaños y aniversarios. Pide antes de las ${SITE.cutoffTime}.`
      : `Same-day flower delivery in ${city.name}, NY (${city.zips.join(", ")}). A local florist ${city.driveMinutes} minutes away — weddings, sympathy, birthdays and anniversaries. Order by ${SITE.cutoffTime}.`,
    alternates: localeAlternates(locale, `/flower-delivery/${slug}`),
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ locale: Locale; city: string }>;
}) {
  const { locale, city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();
  setRequestLocale(locale);
  const es = locale === "es";

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: es ? "Entrega de flores" : "Flower delivery", href: `/${locale}/flower-delivery` },
          { name: `${city.name}, NY`, href: `/${locale}/flower-delivery/${city.slug}` },
        ]}
      />
      <LocalServiceLD locale={locale} city={city} />
      <Grain />
      <LocalHero
        locale={locale}
        city={city}
        eyebrow={es ? `Nassau County · ${city.name}` : `Nassau County · ${city.name}`}
        heading={
          es
            ? `Entrega de flores el mismo día en ${city.name}, NY`
            : `Same-day flower delivery in ${city.name}, NY`
        }
        body={
          es
            ? `Somos una floristería con taller propio en ${SITE.address.line1}, ${SITE.address.locality} — a unos ${city.driveMinutes} minutos de ${city.name}. Todo se diseña a mano el día que sale.`
            : `We are a working studio florist at ${SITE.address.line1}, ${SITE.address.locality} — about ${city.driveMinutes} minutes from ${city.name}. Everything is designed by hand on the day it goes out.`
        }
      />
      <LocalDeliveryNote locale={locale} city={city} />
      <LocalFaq locale={locale} city={city} />
      <LocalLinks locale={locale} city={city} />
    </main>
  );
}
