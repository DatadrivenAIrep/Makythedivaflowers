// components/story/MakingOfFilm.tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/Reveal";
import { MakingOfPlayer } from "@/components/story/MakingOfPlayer";
import type { Locale } from "@/types/locale";

export async function MakingOfFilm({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "story.making_of" });
  return (
    // scroll-mt clears the fixed header when arriving via /story#making-of
    <section id="making-of" className="py-20 scroll-mt-[var(--nav-offset)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <header className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
            <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
            <p className="mt-6 text-base sm:text-lg text-ink/80 leading-relaxed max-w-[58ch]">{t("body")}</p>
          </header>
          <div className="relative aspect-[4/3] max-w-4xl overflow-hidden rounded-2xl bg-ink/5">
            <MakingOfPlayer
              src="/story/making-of.mp4"
              poster="/story/making-of-poster.webp"
              playLabel={t("play")}
              videoLabel={t("video_label")}
              duration="0:46"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
