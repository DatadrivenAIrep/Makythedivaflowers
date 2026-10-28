import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { Hero } from "@/components/home/Hero";
import { AssuranceStrip } from "@/components/home/AssuranceStrip";
import { BentoGrid } from "@/components/home/BentoGrid";
import { BestSellers } from "@/components/home/BestSellers";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { OccasionStrip } from "@/components/home/OccasionStrip";
import { SeasonalPicks } from "@/components/home/SeasonalPicks";
import { DigitalCardsFeature } from "@/components/home/DigitalCardsFeature";
import { SocialProof } from "@/components/home/SocialProof";
import { BehindTheScenes } from "@/components/home/BehindTheScenes";
import { Verticals } from "@/components/home/Verticals";
import { SympathyShowcase } from "@/components/home/SympathyShowcase";
import { StudioVisit } from "@/components/home/StudioVisit";
import { localeAlternates } from "@/lib/seo/alternates";

// The seasonal hero and the occasion strip's seasonal card follow the calendar,
// and the best-sellers shelf follows the sales: regenerate hourly so a season
// starts on its date, not on the next deploy.
export const revalidate = 3600;

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

  // Shopping first — occasion, priced best sellers, the reviews that back them —
  // then the rest of the catalog, then the studio and the people behind it.
  return (
    <main className="bg-bone text-ink">
      <Hero locale={locale} />
      <AssuranceStrip />
      <SeasonalPicks locale={locale} />
      <OccasionStrip locale={locale} />
      <BestSellers locale={locale} />
      <SocialProof />
      <CategoryStrip locale={locale} />
      <DigitalCardsFeature locale={locale} />
      <SympathyShowcase locale={locale} />
      <BentoGrid locale={locale} />
      <Verticals locale={locale} />
      <BehindTheScenes locale={locale} />
      <StudioVisit locale={locale} />
    </main>
  );
}
