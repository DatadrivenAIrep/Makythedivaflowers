import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { buildProductJsonLd } from "@/lib/product-jsonld";

export function PdpStructuredData({
  product,
  locale,
  origin,
}: {
  product: Product;
  locale: Locale;
  origin: string;
}) {
  const data = buildProductJsonLd(product, locale, origin);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
