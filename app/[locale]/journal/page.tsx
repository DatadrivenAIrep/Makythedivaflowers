// app/[locale]/journal/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { motion } from "framer-motion";
import { ZigZagItem } from "@/components/editorial/ZigZagItem";
import { journalArticles } from "@/data/journal";
import { Grain } from "@/components/brand/Grain";
import { StaggerGroup, staggerItemVariants } from "@/components/motion/StaggerGroup";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "journal" });
  return { title: t("page_title"), description: t("page_description"), alternates: { languages: { en: "/en/journal", es: "/es/journal" } } };
}

export default async function JournalIndex({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "journal" });
  const sorted = [...journalArticles].sort((a, b) => b.date.localeCompare(a.date));
  const [featured, ...rest] = sorted;
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <Grain />
      <header className="mb-16 max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-6xl sm:text-7xl text-ink leading-[0.92] tracking-tighter">{t("title")}</h1>
      </header>
      <StaggerGroup className="space-y-20">
        <motion.div variants={staggerItemVariants}>
          <ZigZagItem href={`/${locale}/journal/${featured.slug}`} title={featured.title[locale]} excerpt={featured.excerpt[locale]} date={featured.date} cover={{ src: featured.cover.src, alt: featured.cover.alt[locale] }} featured />
        </motion.div>
        {rest.map((a, i) => (
          <motion.div key={a.slug} variants={staggerItemVariants}>
            <ZigZagItem href={`/${locale}/journal/${a.slug}`} title={a.title[locale]} excerpt={a.excerpt[locale]} date={a.date} cover={{ src: a.cover.src, alt: a.cover.alt[locale] }} reverse={i % 2 === 1} />
          </motion.div>
        ))}
      </StaggerGroup>
    </main>
  );
}
