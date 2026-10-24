import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/product/ProductGrid";
import { bestSellers } from "@/data/product-helpers";
import { getPricedProducts } from "@/lib/product-prices";
import { applyImageOverrides, getAllImageOverrides, type ImageOverride } from "@/lib/product-images";
import { getSalesRanking } from "@/lib/product-sales";
import type { Locale } from "@/types/locale";

function imageOverrides(): ImageOverride[] {
  try {
    return getAllImageOverrides();
  } catch (err) {
    // Catalog photos beat a missing shelf.
    console.error("[home] image overrides unavailable", err);
    return [];
  }
}

/**
 * The first prices on the page: the head of the shop's "Recommended" order
 * (what sells, then Maky's staff picks), right under the occasions. On phones
 * the shelf swipes sideways so it costs one screen, not four.
 */
export async function BestSellers({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.best_sellers");
  const products = bestSellers(applyImageOverrides(getPricedProducts(), imageOverrides()), getSalesRanking());
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="best-sellers-title"
      className="mx-auto max-w-[var(--container-max)] px-6 pt-16 md:pt-24"
    >
      <div className="mb-2 flex items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
            {t("eyebrow")}
          </span>
          <h2
            id="best-sellers-title"
            className="font-display text-4xl leading-[0.95] tracking-tighter md:text-6xl"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30" }}
          >
            {t("title")}
          </h2>
        </div>
        <Link
          href={`/${locale}/shop`}
          className="shrink-0 font-sans text-sm tracking-tight text-ink underline underline-offset-4 hover:no-underline"
        >
          {t("cta")} →
        </Link>
      </div>

      <ProductGrid
        products={products}
        locale={locale}
        priorityCount={0}
        className="-mx-6 flex snap-x snap-mandatory scroll-pl-6 gap-x-4 overflow-x-auto px-6 md:mx-0 md:grid md:grid-cols-4 md:gap-x-6 md:gap-y-14 md:overflow-visible md:px-0"
        itemClassName="w-[62vw] shrink-0 snap-start sm:w-[40vw] md:w-auto"
      />
    </section>
  );
}
