// app/[locale]/legal/terms/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";

const SECTIONS = ["acceptance", "orders", "delivery", "returns", "subscriptions", "limitation", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/legal/terms", es: "/es/legal/terms" } },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const address = formatAddressLine(SITE.address);
  const sections = SECTIONS.map((key) => ({
    heading: t(`${key}.heading`),
    body: [t(`${key}.p1`, { address }), t(`${key}.p2`)],
  }));
  return (
    <LegalShell
      title={t("title")}
      updated={t("updated")}
      sections={sections}
    />
  );
}
