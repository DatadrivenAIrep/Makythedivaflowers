import { SITE } from "@/data/site";

export function LocalBusinessLD() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.brand,
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.line1,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postal,
      addressCountry: "US",
    },
    openingHours: SITE.hours.map((h) => h.schema),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
