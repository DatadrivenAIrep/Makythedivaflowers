// app/[locale]/orchids/page.tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { OrchidsHero } from "@/components/orchids/OrchidsHero";
import { OrchidsWhy } from "@/components/orchids/OrchidsWhy";
import { OrchidsSizes } from "@/components/orchids/OrchidsSizes";
import { OrchidsColors } from "@/components/orchids/OrchidsColors";
import { OrchidsCare } from "@/components/orchids/OrchidsCare";
import { OrchidsCTA } from "@/components/orchids/OrchidsCTA";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orchids" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: localeAlternates(locale, "/orchids"),
  };
}

export default async function OrchidsPage({
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
            name: locale === "es" ? "Orquídeas" : "Orchids",
            href: `/${locale}/orchids`,
          },
        ]}
      />
      <Grain />
      <OrchidsHero locale={locale} />
      <OrchidsWhy locale={locale} />
      <OrchidsSizes locale={locale} />
      <OrchidsColors locale={locale} />
      <OrchidsCare locale={locale} />
      <OrchidsCTA locale={locale} />
    </main>
  );
}
