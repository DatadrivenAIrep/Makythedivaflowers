// app/[locale]/shop/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ShopHubHero } from "@/components/shop/ShopHubHero";
import { CategoryMosaic } from "@/components/shop/CategoryMosaic";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PRODUCTS } from "@/data/products";
import { newestArrivals } from "@/data/product-helpers";

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
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const newest = newestArrivals(PRODUCTS, 12);
  const newestTitle = locale === "es" ? "Lo más nuevo" : "Newest arrivals";
  return (
    <main className="bg-bone text-ink">
      <ShopHubHero locale={locale} />
      <CategoryMosaic locale={locale} />
      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-4xl leading-none tracking-tighter md:text-5xl">
            {newestTitle}
          </h2>
        </div>
        <ProductGrid products={newest} locale={locale} />
      </section>
    </main>
  );
}
