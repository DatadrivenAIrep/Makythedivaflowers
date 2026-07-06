import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

/**
 * A photo-forward image + title + CTA bento tile, used to promote a destination
 * (weddings, events). The photo fills the tile; the eyebrow/title/CTA sit over a
 * soft bottom gradient so the image reads bright (not a dark box). Copy comes
 * from the given i18n `namespace` ({ eyebrow, title, cta }); `href` is the
 * destination and `imageSrc` a real (non-AI) asset under /public.
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
        "group relative overflow-hidden rounded-[var(--radius-bento)]",
        "min-h-[300px] h-full",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      {/* plain <img> so an ad-blocker that blocks /_next/image can't blank the
          tile; assets are already optimized WebP. */}
      <img
        src={imageSrc}
        alt=""
        className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        loading="lazy"
      />
      {/* Gradient only at the bottom so the photo stays bright up top and the
          text stays legible below. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />

      <div className="absolute top-3 left-3">
        <span className="rounded-full bg-ink/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone backdrop-blur-sm">
          {t("eyebrow")}
        </span>
      </div>

      <div className="relative h-full flex flex-col justify-end p-6 gap-3 text-bone">
        <h3
          className="font-display italic text-2xl md:text-3xl tracking-tighter leading-[0.9]"
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
