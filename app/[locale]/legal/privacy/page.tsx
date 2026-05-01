// app/[locale]/legal/privacy/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import type { Locale } from "@/types/locale";

const SECTIONS = ["data_collected", "how_we_use", "sharing", "cookies", "rights", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/legal/privacy", es: "/es/legal/privacy" } },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const sections = SECTIONS.map((key) => ({
    heading: t(`${key}.heading`),
    body: [t(`${key}.p1`), t(`${key}.p2`)],
  }));
  return (
    <LegalShell
      title={t("title")}
      updated={t("updated")}
      sections={sections}
    />
  );
}
