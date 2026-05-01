import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { Grain } from "@/components/brand/Grain";
import { Hero } from "@/components/home/Hero";
import { KineticMarquee } from "@/components/brand/KineticMarquee";
import { BentoGrid } from "@/components/home/BentoGrid";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { EditorialSplit } from "@/components/home/EditorialSplit";
import { WeddingsTeaser } from "@/components/home/WeddingsTeaser";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="bg-bone text-ink">
      <Grain />
      <Hero locale={locale} />
      <KineticMarquee text={`${t("marquee")}  ·  `} />
      <BentoGrid locale={locale} />
      <CategoryStrip locale={locale} />
      <EditorialSplit locale={locale} />
      <WeddingsTeaser locale={locale} />
    </main>
  );
}
