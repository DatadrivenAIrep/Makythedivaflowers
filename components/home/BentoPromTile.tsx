import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PROM_PIECES, FLOWER_GRADIENT } from "@/data/prom-collection";
import { cn } from "@/lib/cn";

export async function BentoPromTile({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento.prom");

  return (
    <div
      className={cn(
        "relative bg-petal text-ink rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[640px] h-full flex flex-col",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
          <span>{t("eyebrow")}</span>
          <span>{t("count")}</span>
        </div>
        <h3
          className="mt-2 font-display italic text-3xl md:text-5xl tracking-tighter leading-[0.9] text-ink"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
      </header>

      <div className="flex-1 grid grid-cols-2 gap-2 px-3">
        {PROM_PIECES.map((piece) => (
          <Link
            key={piece.id}
            href={`/${locale}/prom#${piece.id}`}
            aria-label={`${piece.name[locale]} — $${piece.priceUSD}`}
            className={cn(
              "relative rounded-lg overflow-hidden flex flex-col group focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
              FLOWER_GRADIENT[piece.flower],
            )}
          >
            <img
              src={piece.image.src}
              alt={piece.image.alt[locale]}
              className="absolute inset-0 size-full object-cover transition-opacity group-hover:opacity-90"
              loading="lazy"
            />
            <div className="mt-auto relative bg-petal/95 px-3 py-2 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink truncate">
                {piece.name[locale]}
              </span>
              <span className="font-mono text-[12px] font-semibold text-ink">
                ${piece.priceUSD}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <footer className="px-6 pt-4 pb-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("limited")}
        </span>
        <Link
          href={`/${locale}/prom`}
          className="font-display italic text-base text-ink underline underline-offset-4 hover:no-underline"
        >
          {t("cta")} →
        </Link>
      </footer>
    </div>
  );
}
