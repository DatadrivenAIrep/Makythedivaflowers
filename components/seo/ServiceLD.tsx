// components/seo/ServiceLD.tsx
import { SITE } from "@/data/site";

export function ServiceLD({
  name,
  description,
  serviceType,
}: {
  name: string;
  description: string;
  serviceType: string;
}) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    areaServed: ["Long Island", "Nassau County", "New York metro"],
    provider: {
      "@type": "LocalBusiness",
      name: SITE.brand,
      url: SITE.url,
      telephone: SITE.phone,
      email: SITE.email,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
