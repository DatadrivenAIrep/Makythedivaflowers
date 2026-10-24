import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { AmbientLoop } from "@/components/media/AmbientLoop";
import { TikTokContent } from "@/components/home/TikTokStrip";

// Media left, copy right, like the studio visit block; the TikTok reels follow
// in the same section so the page has one behind-the-scenes stop, not two.
export async function BehindTheScenes({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.behind_scenes");
  return (
    <section className="pt-12 pb-12 md:pt-16 md:pb-16">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7 md:-ml-6">
          <AmbientLoop
            src="/story/behind-the-scenes-loop.mp4"
            poster="/story/behind-the-scenes-poster.webp"
            pauseLabel={t("pause")}
            playLabel={t("play")}
            className="aspect-[4/3] rounded-[var(--radius-bento)] bg-mute-100"
          />
        </div>
        <div className="md:col-span-5 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-4xl md:text-6xl tracking-tighter leading-[1.02]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>
          <p className="text-mute-600 max-w-[42ch] text-base leading-relaxed">{t("body")}</p>
          <a
            href={`/${locale}/story#making-of`}
            className="inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone hover:opacity-90 transition-opacity"
          >
            {t("cta")} →
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[var(--container-max)] px-6 pt-16 md:pt-24">
        {await TikTokContent({ locale })}
      </div>
    </section>
  );
}
