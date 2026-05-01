import { SITE } from "@/data/site";

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbListLDProps {
  items: BreadcrumbItem[];
  baseUrl?: string;
}

export function BreadcrumbListLD({ items, baseUrl = SITE.url }: BreadcrumbListLDProps) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${baseUrl}${item.href}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
