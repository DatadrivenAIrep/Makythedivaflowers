import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { productDetailBlocks } from "@/lib/seo/product-detail";

/**
 * Product detail accordion.
 *
 * This used to render three identical paragraphs on all 96 products — the same
 * stems blurb, the same subscription pitch, the same delivery zones — which is
 * zero unique content on every product page in the catalog. Now each item is
 * built from that product's own stems, variant prices, occasions and lead time.
 *
 * Rendered on the server (no "use client"): <details> needs no JavaScript, and
 * the text has to be in the initial HTML for it to count as page content.
 */
function Item({ label, body }: { label: string; body: string }) {
  return (
    <details className="group border-b border-ink/10 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-base text-ink">
        <span>{label}</span>
        <span className="font-mono text-xs text-mute-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-ink/75">{body}</p>
    </details>
  );
}

export function PdpAccordion({ product, locale }: { product: Product; locale: Locale }) {
  return (
    <div className="border-t border-ink/10">
      {productDetailBlocks(product, locale).map((b) => (
        <Item key={b.key} label={b.label} body={b.body} />
      ))}
    </div>
  );
}
