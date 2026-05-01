// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { MasonryGallery } from "@/components/weddings/MasonryGallery";
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
      <MasonryGallery locale={locale} />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24 bg-petal/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-12 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("form_eyebrow")}</p>
            <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("form_title")}</h2>
          </header>
          <WeddingsForm locale={locale} />
        </div>
      </section>
    </>
  );
}
