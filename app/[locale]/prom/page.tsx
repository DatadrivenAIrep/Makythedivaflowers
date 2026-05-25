// app/[locale]/prom/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { PromHero } from "@/components/prom/PromHero";
import { PromPieces } from "@/components/prom/PromPieces";
import { PromHowItWorks } from "@/components/prom/PromHowItWorks";
import { PromCTA } from "@/components/prom/PromCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "es"
        ? "Flores para Prom — corsages y boutonnières | Diva Flowers"
        : "Prom flowers — corsages & boutonnières | Diva Flowers",
    description:
      locale === "es"
        ? "Corsages y boutonnières para Prom 2026 en Long Island. Cuatro piezas, dos flores, armadas el día anterior. Reserva por WhatsApp o SMS."
        : "Prom corsages and boutonnières for 2026 across Long Island. Four pieces, two flowers, assembled the day before. Reserve by WhatsApp or text.",
    alternates: {
      canonical: `/${locale}/prom`,
      languages: { en: "/en/prom", es: "/es/prom" },
    },
  };
}

export default async function PromPage({
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
          { name: "Prom", href: `/${locale}/prom` },
        ]}
      />
      <Grain />
      <PromHero locale={locale} />
      <PromPieces locale={locale} />
      <PromHowItWorks locale={locale} />
      <PromCTA locale={locale} />
    </main>
  );
}
