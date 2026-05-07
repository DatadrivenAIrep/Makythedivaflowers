import { PRODUCTS } from "@/data/products";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
  slugs: string[];
};

export function MothersDayEdit({ locale, slugs }: Props) {
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const products = slugs
    .map((s) => bySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.active));

  return (
    <section id="md-edit" className="mx-auto max-w-7xl px-4 py-16">
      <ProductGrid products={products} locale={locale} campaign="mothers-day" />
    </section>
  );
}
