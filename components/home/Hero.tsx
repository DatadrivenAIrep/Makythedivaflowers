import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { SpotlightField } from "@/components/motion/SpotlightField";
import type { Locale } from "@/types/locale";

export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.hero");

  return (
    <section className="relative min-h-[100dvh] overflow-hidden">
      <SpotlightField className="absolute inset-0" />
      <div className="relative max-w-[1400px] mx-auto px-6 pt-28 pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        <div className="space-y-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h1
            className="font-display text-[clamp(3rem,7.5vw,7.5rem)] tracking-tighter leading-[0.95]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 80, 'opsz' 144" }}
          >
            {t("title")}
          </h1>
          <p className="text-mute-600 max-w-[52ch] text-base md:text-lg leading-relaxed">
            {t("sub")}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <MagneticButton href={`/${locale}/shop/arrangements`} ariaLabel={t("cta_primary")}>
              {t("cta_primary")}
            </MagneticButton>
            <Link
              href={`/${locale}/weddings`}
              className="font-sans text-sm tracking-tight underline-offset-4 hover:underline text-ink/80"
            >
              {t("cta_secondary")} →
            </Link>
          </div>
        </div>
        <div className="aspect-[4/5] text-rouge">
          <ArchSVG className="size-full">
            <img
              alt=""
              src="https://picsum.photos/seed/diva-hero-arrangement/900/1100"
              className="size-full object-cover"
            />
          </ArchSVG>
        </div>
      </div>
    </section>
  );
}
