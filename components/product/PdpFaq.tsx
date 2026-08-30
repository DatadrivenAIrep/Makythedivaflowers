import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { productFaq } from "@/lib/seo/product-detail";

/**
 * Pre-purchase questions, answered on the page.
 *
 * Rendered as plain content, deliberately not marked up as FAQPage: Google
 * narrowed FAQ rich results to government and health sites in 2023, so the
 * markup would earn a florist nothing. The answers still do the work — they
 * settle the substitution and same-day questions that otherwise become a phone
 * call, and they are what AI answer engines quote.
 */
export function PdpFaq({ product, locale }: { product: Product; locale: Locale }) {
  const faq = productFaq(product, locale);
  if (!faq.length) return null;

  return (
    <section
      aria-label={locale === "es" ? "Preguntas frecuentes" : "Frequently asked questions"}
      className="mt-12 border-t border-ink/10 pt-8"
    >
      <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
        {locale === "es" ? "Preguntas frecuentes" : "Common questions"}
      </h2>
      <dl className="mt-6 space-y-6">
        {faq.map((f) => (
          <div key={f.q} className="max-w-2xl">
            <dt className="font-sans text-base font-medium text-ink">{f.q}</dt>
            <dd className="mt-2 font-sans text-sm leading-relaxed text-ink/70">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
