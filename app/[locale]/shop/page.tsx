// app/[locale]/shop/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ShopHubHero } from "@/components/shop/ShopHubHero";
import { CategoryMosaic } from "@/components/shop/CategoryMosaic";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterBar } from "@/components/product/FilterBar";
import { EmptyFilterState } from "@/components/product/EmptyFilterState";
import { PRODUCTS } from "@/data/products";
import {
  newestArrivals,
  filterProducts,
  sortProducts,
} from "@/data/product-helpers";
import { parseFilterParams, type RawSearchParams } from "@/lib/search-params";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "es"
        ? "Tienda — Diva Flowers"
        : "Shop — Diva Flowers",
    description:
      locale === "es"
        ? "Compra arreglos, ramos, plantas y regalos. Entrega el mismo día en Long Island."
        : "Shop arrangements, bouquets, plants, and gifts. Same-day delivery on Long Island.",
    alternates: {
      canonical: `/${locale}/shop`,
      languages: { en: "/en/shop", es: "/es/shop" },
    },
  };
}

export default async function ShopHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { filter, sort } = parseFilterParams(sp);

  const newest = newestArrivals(PRODUCTS.filter((p) => !p.giftExtra), 12);
  const newestTitle = locale === "es" ? "Lo más nuevo" : "Newest arrivals";

  const allActive = PRODUCTS.filter((p) => p.active && !p.giftExtra);
  const allFiltered = sortProducts(filterProducts(allActive, filter), sort);
  const allTitle = locale === "es" ? "Todos los productos" : "All products";
  const allSubtitle =
    locale === "es"
      ? `${allFiltered.length} de ${allActive.length}`
      : `${allFiltered.length} of ${allActive.length}`;

  return (
    <main className="bg-bone text-ink">
      <ShopHubHero locale={locale} />
      <CategoryMosaic locale={locale} />
      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-16">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-4xl leading-none tracking-tighter md:text-5xl">
            {newestTitle}
          </h2>
        </div>
        <ProductGrid products={newest} locale={locale} />
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-4xl leading-none tracking-tighter md:text-5xl">
            {allTitle}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
            {allSubtitle}
          </p>
        </div>
        <FilterBar
          locale={locale}
          filter={filter}
          sort={sort}
          show={["occasion", "color", "size", "price", "sameDay"]}
        />
        <div className="py-10">
          {allFiltered.length === 0 ? (
            <EmptyFilterState locale={locale} resetHref={`/${locale}/shop`} />
          ) : (
            <ProductGrid products={allFiltered} locale={locale} />
          )}
        </div>
      </section>
    </main>
  );
}
