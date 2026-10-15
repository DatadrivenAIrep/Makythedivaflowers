import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";

/**
 * A photo-forward bento tile that features one shoppable product. The whole
 * arrangement floats on a plaster tile; an eyebrow chip sits top-left, a price
 * pill top-right, and the title + CTA sit on the plaster below the photo.
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
  priceUSD?: number;
}) {
  const t = await getTranslations(namespace);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-bento)] bg-mute-100",
        "min-h-[440px] md:min-h-[600px] h-full",
      )}
    >
      {/* The whole arrangement floats on the plaster (its own photo background)
          above the title; it lifts a little on hover. */}
      <FloatingPhoto
        src={imageSrc}
        alt={imageAlt}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="inset-x-6 top-14 bottom-32 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 motion-reduce:transform-none md:bottom-36"
      />

      <div className="absolute top-4 left-4">
        <span className="rounded-full border border-ink/10 bg-bone/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink">
          {t("eyebrow")}
        </span>
      </div>

      <div className="absolute top-4 right-4">
        <span className="rounded-full border border-ink/10 bg-bone/90 px-3.5 py-1.5 font-mono text-[12px] md:text-sm tracking-[0.02em] text-ink">
          {priceUSD != null ? `$${priceUSD.toLocaleString("en-US")}` : t("quote")}
        </span>
      </div>

      <div className="relative h-full flex flex-col justify-end p-6 md:p-8 gap-3 text-ink">
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
