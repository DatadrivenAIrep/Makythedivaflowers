import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SympathyHero } from "@/components/sympathy/SympathyHero";
import { SympathyProcess } from "@/components/sympathy/SympathyProcess";
import { SympathyGallery } from "@/components/sympathy/SympathyGallery";
import { SympathySmallerPieces } from "@/components/sympathy/SympathySmallerPieces";
import { SympathyFuneralHomes } from "@/components/sympathy/SympathyFuneralHomes";
import { SympathyTrust } from "@/components/sympathy/SympathyTrust";
import { SympathyInquiryForm } from "@/components/sympathy/SympathyInquiryForm";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "es"
        ? "Pésame y memoriales — Diva Flowers"
        : "Sympathy & memorials — Diva Flowers",
    description:
      locale === "es"
        ? "Arreglos funerarios y memoriales a medida en Long Island y Queens. Coordinamos directamente con funerarias. Llamada o consulta."
        : "Custom funeral arrangements and memorial installations across Long Island and Queens. We coordinate directly with funeral homes.",
    alternates: {
      canonical: `/${locale}/sympathy`,
      languages: {
        en: "/en/sympathy",
        es: "/es/sympathy",
      },
    },
  };
}

export default async function SympathyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
          {
            name: locale === "es" ? "Pésame" : "Sympathy",
            href: `/${locale}/sympathy`,
          },
        ]}
      />
      <Grain />
      <SympathyHero locale={locale} />
      <SympathyProcess locale={locale} />
      <SympathyGallery locale={locale} />
      <SympathySmallerPieces locale={locale} />
      <SympathyFuneralHomes locale={locale} />
      <SympathyTrust locale={locale} />
      <SympathyInquiryForm locale={locale} />
    </main>
  );
}
