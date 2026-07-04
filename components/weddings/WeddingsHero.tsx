// components/weddings/WeddingsHero.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { RatingChip } from "@/components/social/RatingChip";
import { REVIEWS_AGGREGATE } from "@/data/reviews";
import type { Locale } from "@/types/locale";

export async function WeddingsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "weddings" });
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      <Image
        src="/images/wedding-stories-header.webp"
        alt={t("hero_alt")}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">{t("eyebrow")}</p>
          <h1 className="font-display text-bone text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-tighter">
            {t("hero_title")}
          </h1>
          <p className="text-bone/85 text-lg max-w-[52ch]">{t("hero_sub")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <MagneticButton href={`/${locale}/weddings#inquire`} ariaLabel={t("hero_cta")}>
              {t("hero_cta")}
            </MagneticButton>
          </div>
          <RatingChip
            label={t("rating_chip", {
              rating: String(REVIEWS_AGGREGATE.rating),
              count: REVIEWS_AGGREGATE.total,
            })}
          />
        </div>
      </div>
    </section>
  );
}
