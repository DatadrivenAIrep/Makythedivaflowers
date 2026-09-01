import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { OccasionStrip } from "@/components/home/OccasionStrip";
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";
import { SocialProof } from "@/components/home/SocialProof";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { Verticals } from "@/components/home/Verticals";
import { SympathyShowcase } from "@/components/home/SympathyShowcase";
import { StudioVisit } from "@/components/home/StudioVisit";
import { NewsletterField } from "@/components/home/NewsletterField";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = locale === "es" ? "es" : "en";
  return {
    title: SITE.metadata.title[lang],
    description: SITE.metadata.description[lang],
    alternates: localeAlternates(locale),
  };
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const marquee = SITE.marquee.tokens.join(" · ");

  return (
    <main className="bg-bone text-ink">
      <Hero locale={locale} />
      <KineticMarquee text={`${marquee}  ·  `} />
      <OccasionStrip locale={locale} />
      <section className="mx-auto max-w-[var(--container-max)] px-6 py-14 md:py-16">
        <div className="rounded-[var(--radius-bento)] border border-mute-100 px-6 py-8 md:px-10">
          <GiftAssuranceBar size="md" surface="home" locale={locale} />
        </div>
      </section>
      <CategoryStrip locale={locale} />
      <BentoGrid locale={locale} />
      <SocialProof locale={locale} />
      <SympathyShowcase locale={locale} />
      <Verticals locale={locale} />
      <EditorialSplit locale={locale} />
      <StudioVisit locale={locale} />
      <NewsletterField />
    </main>
  );
}
