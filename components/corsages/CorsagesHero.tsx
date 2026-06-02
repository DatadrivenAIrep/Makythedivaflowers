// components/corsages/CorsagesHero.tsx
// Photos use plain <img> (not next/image) so the decorative collage renders
// even when an ad-blocker or privacy extension blocks the /_next/image
// optimizer. The assets are pre-optimized WebP (q82, max 1600px). This also
// matches the raw-<img> pattern used by CorsagesPieces.
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function CorsagesHero({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <header className="relative isolate overflow-hidden">
      {/* 3-photo collage: left column spans 2 rows, right column splits into 2 cells */}
      <div
        className="grid h-[70vh] min-h-[480px] max-h-[800px]"
        style={{ gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr" }}
      >
        {/* Main photo — spans both rows */}
        <div className="relative row-span-2 overflow-hidden">
          <img
            src="/corsages/hero-1.webp"
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="eager"
          />
        </div>
        {/* Top-right photo */}
        <div className="relative overflow-hidden border-l-2 border-b border-bone">
          <img
            src="/corsages/hero-2.webp"
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="eager"
          />
        </div>
        {/* Bottom-right photo */}
        <div className="relative overflow-hidden border-l-2 border-t border-bone">
          <img
            src="/corsages/hero-3.webp"
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="eager"
          />
        </div>
      </div>

      {/* Dark gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(14,13,12,0.72) 0%, rgba(14,13,12,0.2) 55%, transparent 100%)",
        }}
      />

      {/* Text anchored bottom-left */}
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
      </div>
    </header>
  );
}
