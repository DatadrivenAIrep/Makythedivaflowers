import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

/**
 * A photo-forward bento tile that features one shoppable product. The photo
 * fills the tile; an eyebrow chip sits top-left, a price pill top-right, and
 * the title + CTA sit over a soft bottom gradient so the image reads bright.
 * Copy comes from the given i18n `namespace` ({ eyebrow, title, cta }); the
 * CTA links to the product's PDP. Mirrors BentoPromoTile's silhouette so the
 * two sit together cleanly in the bento grid.
 */
export async function BentoSignatureTile({
  locale,
  namespace,
  imageSrc,
  imageAlt,
  slug,
  priceUSD,
}: {
  locale: Locale;
  namespace: string;
  imageSrc: string;
  imageAlt: string;
  slug: string;
  priceUSD: number;
}) {
  const t = await getTranslations(namespace);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-bento)]",
        "min-h-[440px] md:min-h-[600px] h-full",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      {/* plain <img> so an ad-blocker that blocks /_next/image can't blank the
          tile; the asset is already optimized WebP. */}
      <img
        src={imageSrc}
        alt={imageAlt}
        className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        style={{ filter: "saturate(1.15) contrast(1.03)", objectPosition: "50% 32%" }}
        loading="lazy"
      />
      {/* Gradient only at the bottom so the photo stays bright up top and the
          text stays legible below. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />

      <div className="absolute top-4 left-4">
        <span className="rounded-full bg-ink/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone backdrop-blur-sm">
          {t("eyebrow")}
        </span>
      </div>

      <div className="absolute top-4 right-4">
        <span className="rounded-full bg-bone/90 px-3.5 py-1.5 font-mono text-[12px] md:text-sm tracking-[0.02em] text-ink backdrop-blur-sm">
          ${priceUSD.toLocaleString("en-US")}
        </span>
      </div>

      <div className="relative h-full flex flex-col justify-end p-6 md:p-8 gap-3 text-bone">
        <h3
          className="font-display italic text-3xl md:text-5xl tracking-tighter leading-[0.9]"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
        <Link
          href={`/${locale}/product/${slug}`}
          className="self-start rounded-full bg-rouge px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone transition hover:bg-rouge/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60"
        >
          {t("cta")} →
        </Link>
      </div>
    </div>
  );
}
