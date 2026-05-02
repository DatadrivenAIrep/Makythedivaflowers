// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
import { WeddingsFAQ } from "@/components/weddings/WeddingsFAQ";
import { PricingIntent } from "@/components/weddings/PricingIntent";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: { languages: { en: "/en/weddings", es: "/es/weddings" } },
  };
}

export default async function WeddingsPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return (
    <>
      <WeddingsHero locale={locale} />
      <ProcessStrip />
      <PricingIntent locale={locale} />
      <GalleryEditorial locale={locale} />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24">
        <WeddingsForm locale={locale} />
      </section>
    </>
  );
}
