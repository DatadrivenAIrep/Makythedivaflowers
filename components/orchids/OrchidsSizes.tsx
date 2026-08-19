import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { formatMoneyCents } from "@/lib/format";

const SLUG = "phalaenopsis-orchid";

// One photo per size, so the card shows what you actually get.
const PHOTO_BY_VARIANT: Record<string, string> = {
  single: "/products/phalaenopsis-white-single.webp",
  double: "/products/phalaenopsis-pink-double.webp",
};

export async function OrchidsSizes({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  const product = PRODUCTS.find((p) => p.slug === SLUG);
  if (!product) return null;

  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("sizes_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("sizes_title")}
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {product.variants.map((v) => {
            const photoSrc = PHOTO_BY_VARIANT[v.id];
            const image =
              product.images.find((img) => img.src === photoSrc) ?? product.images[0];
            return (
            <li
              key={v.id}
              className="overflow-hidden rounded-[var(--radius-bento)] bg-petal"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={image.src}
                  alt={image.alt[locale]}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display italic text-2xl leading-tight">
                    {v.label[locale]}
                  </h3>
                  <span className="whitespace-nowrap font-mono text-base font-semibold">
                    {formatMoneyCents(v.priceCents, locale)}
                  </span>
                </div>
                {v.subtitle ? (
                  <p className="font-sans text-sm leading-relaxed text-ink/80">
                    {v.subtitle[locale]}
                  </p>
                ) : null}
                <Link
                  href={`/${locale}/product/${SLUG}`}
                  className="mt-1 self-start rounded-full border border-ink/25 px-5 py-2 font-sans text-sm transition-colors hover:bg-ink hover:text-bone"
                >
                  {t("sizes_cta")}
                </Link>
              </div>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
