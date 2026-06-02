// app/[locale]/corsages-boutonnieres/page.tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { CorsagesHero } from "@/components/corsages/CorsagesHero";
import { CorsagesPieces } from "@/components/corsages/CorsagesPieces";
import { CorsagesHowItWorks } from "@/components/corsages/CorsagesHowItWorks";
import { CorsagesCTA } from "@/components/corsages/CorsagesCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "corsages" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/corsages-boutonnieres`,
      languages: {
        en: "/en/corsages-boutonnieres",
        es: "/es/corsages-boutonnieres",
      },
    },
  };
}

export default async function CorsagesBoutonnieresPage({
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
            name:
              locale === "es"
                ? "Corsages y Boutonnières"
                : "Corsages & Boutonnières",
            href: `/${locale}/corsages-boutonnieres`,
          },
        ]}
      />
      <Grain />
      <CorsagesHero locale={locale} />
      <CorsagesPieces locale={locale} />
      <CorsagesHowItWorks locale={locale} />
      <CorsagesCTA locale={locale} />
    </main>
  );
}
