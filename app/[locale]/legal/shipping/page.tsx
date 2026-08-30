// app/[locale]/legal/shipping/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE } from "@/data/site";
import { deliveryZones } from "@/data/delivery-zones";
import { formatAddressLine, formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.shipping" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: localeAlternates(locale, "/legal/shipping"),
  };
}

export default async function ShippingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.shipping" });
  const values = {
    address: formatAddressLine(SITE.address),
    email: SITE.email,
    phone: SITE.mobile.display,
    cutoff: SITE.cutoffTime,
  };
  const rateLines = deliveryZones.map((z) => {
    const rate = z.priceCentsMax
      ? `${formatMoneyCents(z.priceCents, locale)}–${formatMoneyCents(z.priceCentsMax, locale)}`
      : formatMoneyCents(z.priceCents, locale);
    return `${z.label[locale]} — ${rate}`;
  });
  const sections = [
    { heading: t("areas.heading"), body: [t("areas.intro"), ...rateLines] },
    { heading: t("sameday.heading"), body: [t("sameday.p1", values), t("sameday.p2", values)] },
    { heading: t("outofarea.heading"), body: [t("outofarea.p1", values)] },
    { heading: t("contact.heading"), body: [t("contact.p1", values), t("contact.p2", values)] },
  ];
  return <LegalShell title={t("title")} updated={t("updated")} sections={sections} />;
}
