// app/[locale]/legal/returns/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

const SECTIONS = ["guarantee", "reporting", "substitutions", "cancellations", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.returns" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: localeAlternates(locale, "/legal/returns"),
  };
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.returns" });
  const values = {
    address: formatAddressLine(SITE.address),
    email: SITE.email,
    phone: SITE.mobile.display,
  };
  const sections = SECTIONS.map((key) => ({
    heading: t(`${key}.heading`),
    body: [t(`${key}.p1`, values), t(`${key}.p2`, values)],
  }));
  return <LegalShell title={t("title")} updated={t("updated")} sections={sections} />;
}
