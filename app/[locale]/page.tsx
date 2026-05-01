import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { WeddingsTeaser } from "@/components/home/WeddingsTeaser";
import { NewsletterField } from "@/components/home/NewsletterField";

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
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        es: "/es",
      },
    },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const marquee = SITE.marquee.tokens.join(" · ");

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
      <KineticMarquee text={`${marquee}  ·  `} />
      <BentoGrid locale={locale} />
      <CategoryStrip locale={locale} />
      <EditorialSplit locale={locale} />
      <WeddingsTeaser locale={locale} />
      <NewsletterField />
    </main>
  );
}
