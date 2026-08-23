// components/orchids/OrchidsHero.tsx
// Raw <img> (not next/image) to match CorsagesHero: the asset is already
// pre-optimized WebP, and this keeps the hero visible when a privacy
// extension blocks the /_next/image optimizer.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function OrchidsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <header className="relative isolate overflow-hidden">
      <div className="relative h-[72vh] min-h-[500px] max-h-[820px]">
        <img
          src="/products/phalaenopsis-white-single.webp"
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
          loading="eager"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(14,13,12,0.78) 0%, rgba(14,13,12,0.25) 55%, transparent 100%)",
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 px-6 pb-10 sm:px-10 sm:pb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-petal/80">
          {t("hero_eyebrow")}
        </p>
        <h1
          className="mt-3 max-w-2xl font-display text-5xl leading-[0.95] tracking-tighter text-bone sm:text-6xl md:text-7xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("hero_title")}
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-bone/70 sm:text-base">
          {t("hero_sub")}
        </p>
        <Link
          href={`/${locale}/product/phalaenopsis-orchid`}
          className="mt-6 inline-block rounded-full border border-bone/40 px-6 py-2.5 font-sans text-sm text-bone transition-[transform,background-color,border-color,color,opacity] [transition-duration:var(--motion-fast)] active:scale-[0.97] will-change-transform hover:bg-bone hover:text-ink"
        >
          {t("hero_cta")}
        </Link>
      </div>
    </header>
  );
}
