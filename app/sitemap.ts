// app/sitemap.ts
import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/data/products";
import { journalArticles } from "@/data/journal";
import { locales } from "@/types/locale";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://divaflowers.com";

const STATIC_PATHS = [
  "",
  "shop",
  "shop/arrangements",
  "shop/bouquets",
  "shop/plants",
  "shop/gifts",
  "shop/sympathy",
  "subscriptions",
  "weddings",
  "events",
  "story",
  "journal",
  "contact",
  "legal/privacy",
  "legal/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const p of STATIC_PATHS) {
      const path = p ? `/${locale}/${p}` : `/${locale}`;
      entries.push({
        url: `${SITE}${path}`,
        lastModified: now,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}${p ? `/${l}/${p}` : `/${l}`}`]),
          ),
        },
      });
    }
    for (const product of PRODUCTS) {
      entries.push({
        url: `${SITE}/${locale}/product/${product.slug}`,
        lastModified: now,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}/${l}/product/${product.slug}`]),
          ),
        },
      });
    }
    for (const article of journalArticles) {
      entries.push({
        url: `${SITE}/${locale}/journal/${article.slug}`,
        lastModified: new Date(article.date + "T00:00:00"),
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE}/${l}/journal/${article.slug}`]),
          ),
        },
      });
    }
  }
  return entries;
}
