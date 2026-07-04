// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { WeddingStories } from "@/components/weddings/WeddingStories";
import { WeddingsFAQ } from "@/components/weddings/WeddingsFAQ";
import { PricingIntent } from "@/components/weddings/PricingIntent";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";
import { WhatHappensNext } from "@/components/inquiry/WhatHappensNext";
import { Testimonials } from "@/components/social/Testimonials";
import { reviewsByOccasion } from "@/data/review-helpers";
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
  const t = await getTranslations({ locale, namespace: "weddings.testimonials" });
  const tn = await getTranslations({ locale, namespace: "weddings.next_steps" });
  return (
    <>
      <WeddingsHero locale={locale} />
      <ProcessStrip />
      <PricingIntent locale={locale} />
      <WeddingStories locale={locale} />
      <Testimonials
        reviews={reviewsByOccasion("Boda")}
        locale={locale}
        eyebrow={t("eyebrow")}
        title={t("title")}
      />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24">
        <WhatHappensNext
          title={tn("title")}
          steps={[tn("step1"), tn("step2"), tn("step3")]}
        />
        <WeddingsForm locale={locale} />
      </section>
    </>
  );
}
