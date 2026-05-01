// app/[locale]/shop/[category]/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import {
  productsByCategory,
  filterProducts,
  sortProducts,
} from "@/data/product-helpers";
import type { ProductCategory } from "@/types/product";
import { parseFilterParams, type RawSearchParams } from "@/lib/search-params";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterBar } from "@/components/product/FilterBar";
import { EmptyFilterState } from "@/components/product/EmptyFilterState";
import { Grain } from "@/components/brand/Grain";
import { SITE } from "@/data/site";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";

const ALLOWED: ProductCategory[] = [
  "arrangements",
  "bouquets",
  "plants",
  "gifts",
  "sympathy",
  "subscriptions",
];

const CATEGORY_TITLES: Record<ProductCategory, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};

const CATEGORY_DESCS: Record<ProductCategory, { en: string; es: string }> = {
  arrangements: {
    en: "Statement arrangements, hand-built daily.",
    es: "Arreglos de declaración, hechos a mano cada día.",
  },
  bouquets: {
    en: "Hand-tied bouquets, cut and wrapped the morning of delivery.",
    es: "Ramos atados a mano, cortados y envueltos la mañana del envío.",
  },
  plants: {
    en: "Long-lasting plants and orchids in studio-poured planters.",
    es: "Plantas y orquídeas duraderas en maceteros del estudio.",
  },
  gifts: {
    en: "Pairings: flowers with champagne, candles, or pastries.",
    es: "Maridajes: flores con champaña, velas o pastelería.",
  },
  sympathy: {
    en: "When words are not enough.",
    es: "Cuando las palabras no bastan.",
  },
  subscriptions: {
    en: "Weekly or biweekly blooms. Pause anytime.",
    es: "Flores semanales o quincenales. Pausa cuando quieras.",
  },
};

export async function generateStaticParams() {
  return ALLOWED.map((c) => ({ category: c }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  if (!(ALLOWED as string[]).includes(category)) return {};
  const cat = category as ProductCategory;
  return {
    title: `${CATEGORY_TITLES[cat][locale]} — Diva Flowers`,
    description: CATEGORY_DESCS[cat][locale],
    alternates: {
      canonical: `/${locale}/shop/${category}`,
      languages: {
        en: `/en/shop/${category}`,
        es: `/es/shop/${category}`,
      },
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; category: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, category } = await params;
  if (!(ALLOWED as string[]).includes(category)) notFound();
  setRequestLocale(locale);

  const cat = category as ProductCategory;
  const sp = await searchParams;
  const { filter, sort } = parseFilterParams(sp);

  const all = productsByCategory(PRODUCTS, cat);
  const filtered = sortProducts(filterProducts(all, filter), sort);

  const isSympathy = cat === "sympathy";
  const motionMode = isSympathy ? "sympathy" : "default";
  const filtersToShow: Array<"occasion" | "color" | "size" | "price" | "sameDay"> = isSympathy
    ? ["price", "sameDay"]
    : ["occasion", "color", "size", "price", "sameDay"];

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
          { name: locale === "es" ? "Tienda" : "Shop", href: `/${locale}/shop` },
          { name: CATEGORY_TITLES[cat][locale], href: `/${locale}/shop/${cat}` },
        ]}
      />
      {isSympathy && <Grain />}
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-12 pb-6 md:pt-20">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {locale === "es" ? "Categoría" : "Category"}
        </p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tighter md:text-7xl">
          {CATEGORY_TITLES[cat][locale]}
        </h1>
        <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink/75 md:text-lg">
          {CATEGORY_DESCS[cat][locale]}
        </p>
      </header>

      <FilterBar locale={locale} filter={filter} sort={sort} show={filtersToShow} />

      <section className="mx-auto max-w-[var(--container-max)] px-6 py-10">
        {filtered.length === 0 ? (
          <EmptyFilterState locale={locale} resetHref={`/${locale}/shop/${cat}`} />
        ) : (
          <ProductGrid products={filtered} locale={locale} motionMode={motionMode} />
        )}
      </section>

      {isSympathy && (
        <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
          <div className="rounded-[var(--radius-bento)] border border-ink/10 p-8 md:p-12">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {locale === "es" ? "O llámanos" : "Or call us"}
            </p>
            <p className="mt-3 font-mono text-2xl text-ink md:text-3xl">
              <a href={SITE.phoneHref} className="hover:text-rouge transition-colors">
                {SITE.phoneDisplay}
              </a>
            </p>
            <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink/75">
              {locale === "es"
                ? "Coordinamos personalmente con funerarias de Long Island y Queens. Llámanos para servicios el mismo día."
                : "We coordinate directly with Long Island and Queens funeral homes. Call us for same-day service."}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
