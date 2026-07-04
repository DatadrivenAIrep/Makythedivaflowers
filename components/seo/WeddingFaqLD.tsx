// components/seo/WeddingFaqLD.tsx
import { weddingFAQ } from "@/data/wedding-faq";
import type { Locale } from "@/types/locale";

export function WeddingFaqLD({ locale }: { locale: Locale }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: weddingFAQ.map((f) => ({
      "@type": "Question",
      name: f.q[locale],
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a[locale],
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
