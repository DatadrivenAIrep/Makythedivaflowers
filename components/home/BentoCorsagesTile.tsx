import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

export async function BentoCorsagesTile({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento.corsages");

  return (
    <div
      className={cn(
        "relative bg-ink text-bone rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[640px] h-full flex flex-col",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      {/* Hero image — plain <img> so an ad-blocker that blocks /_next/image
          can't blank the tile; asset is already an optimized WebP. */}
      <div className="relative flex-1 min-h-[220px]">
        <img
          src="/corsages/hero-1.webp"
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        {/* Gradient to ensure badges are readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 to-ink/10" />

        {/* Category badge — top left */}
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-ink/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-petal backdrop-blur-sm">
            {t("eyebrow")}
          </span>
        </div>

        {/* Count badge — top right */}
        <div className="absolute top-3 right-3">
          <span className="rounded-full bg-ink/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone/60 backdrop-blur-sm">
            {t("count")}
          </span>
        </div>
      </div>

      {/* Text body */}
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          Corsages · Boutonnières
        </p>
        <h3
          className="font-display italic text-3xl md:text-4xl tracking-tighter leading-[0.9] text-bone"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
        <Link
          href={`/${locale}/corsages-boutonnieres`}
          className="self-start rounded-full bg-rouge px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone transition hover:bg-rouge/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60"
        >
          {t("cta")} →
        </Link>
      </div>
    </div>
  );
}
