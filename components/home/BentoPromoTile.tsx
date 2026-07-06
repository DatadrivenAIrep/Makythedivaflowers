import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

/**
 * A generic image + title + CTA bento tile, used to promote a destination
 * (weddings, events). Copy comes from the given i18n `namespace`
 * ({ eyebrow, title, cta }); `href` is the destination and `imageSrc` a real
 * (non-AI) asset under /public.
 */
export async function BentoPromoTile({
  locale,
  namespace,
  imageSrc,
  href,
}: {
  locale: Locale;
  namespace: string;
  imageSrc: string;
  href: string;
}) {
  const t = await getTranslations(namespace);

  return (
    <div
      className={cn(
        "relative bg-ink text-bone rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[300px] h-full flex flex-col",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <div className="relative flex-1 min-h-[140px]">
        {/* plain <img> so an ad-blocker that blocks /_next/image can't blank the
            tile; assets are already optimized WebP. */}
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 to-ink/10" />
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-ink/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-petal backdrop-blur-sm">
            {t("eyebrow")}
          </span>
        </div>
      </div>

      <div className="px-6 pt-4 pb-5 flex flex-col gap-3">
        <h3
          className="font-display italic text-2xl md:text-3xl tracking-tighter leading-[0.9] text-bone"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
        <Link
          href={href}
          className="self-start rounded-full bg-rouge px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone transition hover:bg-rouge/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60"
        >
          {t("cta")} →
        </Link>
      </div>
    </div>
  );
}
