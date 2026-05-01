// components/story/StoryHero.tsx
import { getTranslations } from "next-intl/server";
import { PullQuote } from "@/components/editorial/PullQuote";
import type { Locale } from "@/types/locale";

export async function StoryHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.hero" });
  return (
    <section className="pt-32 pb-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
      <h1 className="mt-3 font-display text-7xl sm:text-8xl text-ink leading-[0.9] tracking-tighter max-w-4xl">
        {t("title")}
      </h1>
      <div className="mt-12">
        <PullQuote cite={t("cite")}>{t("quote")}</PullQuote>
      </div>
    </section>
  );
}
