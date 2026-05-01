// app/[locale]/story/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StoryHero } from "@/components/story/StoryHero";
import { ArchSection } from "@/components/story/ArchSection";
import { FounderPortrait } from "@/components/story/FounderPortrait";
import { PressLogos } from "@/components/story/PressLogos";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "story" });
  return { title: t("page_title"), description: t("page_description"), alternates: { languages: { en: "/en/story", es: "/es/story" } } };
}

export default async function StoryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <main>
      <StoryHero locale={locale} />
      <ArchSection locale={locale} />
      <FounderPortrait locale={locale} />
      <PressLogos locale={locale} />
    </main>
  );
}
