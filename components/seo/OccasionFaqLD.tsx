import type { Locale } from "@/types/locale";
import type { OccasionContent } from "@/data/occasion-content";

/**
 * FAQPage for one occasion landing. Every question here is also rendered
 * visibly on the page — schema-only FAQ markup is against Google's guidelines
 * and does nothing for the person actually reading.
 */
export function OccasionFaqLD({
  locale,
  content,
}: {
  locale: Locale;
  content: OccasionContent;
}) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((f) => ({
      "@type": "Question",
      name: f.q[locale],
      acceptedAnswer: { "@type": "Answer", text: f.a[locale] },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
