// app/sitemap.ts
import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/data/products";
import { isAvailableNow } from "@/data/product-helpers";
import { journalArticles } from "@/data/journal";
import { locales } from "@/types/locale";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";

// Every indexable static route, with the crawl priority we want Google to use.
// Was previously hand-maintained and had drifted: it listed /prom (a 308
// redirect to /corsages-boutonnieres) and omitted /sympathy, /mothers-day and
// three legal pages entirely.
const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1.0, changeFrequency: "daily" },
  { path: "shop", priority: 0.9, changeFrequency: "daily" },
  { path: "shop/arrangements", priority: 0.8, changeFrequency: "weekly" },
  { path: "shop/bouquets", priority: 0.8, changeFrequency: "weekly" },
  { path: "shop/roses", priority: 0.8, changeFrequency: "weekly" },
  { path: "shop/exotic", priority: 0.7, changeFrequency: "weekly" },
  { path: "shop/plants", priority: 0.7, changeFrequency: "weekly" },
  { path: "shop/gifts", priority: 0.7, changeFrequency: "weekly" },
  { path: "shop/sympathy", priority: 0.8, changeFrequency: "weekly" },
  { path: "sympathy", priority: 0.9, changeFrequency: "monthly" },
  { path: "weddings", priority: 0.9, changeFrequency: "monthly" },
  { path: "corsages-boutonnieres", priority: 0.8, changeFrequency: "monthly" },
  { path: "orchids", priority: 0.7, changeFrequency: "monthly" },
  { path: "subscriptions", priority: 0.7, changeFrequency: "monthly" },
  { path: "events", priority: 0.7, changeFrequency: "monthly" },
  { path: "mothers-day", priority: 0.6, changeFrequency: "monthly" },
  { path: "story", priority: 0.6, changeFrequency: "yearly" },
  { path: "journal", priority: 0.7, changeFrequency: "weekly" },
  { path: "contact", priority: 0.8, changeFrequency: "yearly" },
  { path: "legal/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "legal/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "legal/returns", priority: 0.3, changeFrequency: "yearly" },
  { path: "legal/shipping", priority: 0.3, changeFrequency: "yearly" },
  { path: "legal/sms-consent", priority: 0.2, changeFrequency: "yearly" },
];

const langs = (p: string) =>
  Object.fromEntries([
    ...locales.map((l) => [l, `${SITE}${p ? `/${l}/${p}` : `/${l}`}`]),
    ["x-default", `${SITE}${p ? `/en/${p}` : "/en"}`],
  ]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const { path: p, priority, changeFrequency } of STATIC_PATHS) {
      entries.push({
        url: `${SITE}${p ? `/${locale}/${p}` : `/${locale}`}`,
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages: langs(p) },
      });
    }
    for (const product of PRODUCTS.filter((p) => isAvailableNow(p))) {
      entries.push({
        url: `${SITE}/${locale}/product/${product.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langs(`product/${product.slug}`) },
      });
    }
    for (const article of journalArticles) {
      entries.push({
        url: `${SITE}/${locale}/journal/${article.slug}`,
        lastModified: new Date(article.date + "T00:00:00"),
        changeFrequency: "yearly",
        priority: 0.5,
        alternates: { languages: langs(`journal/${article.slug}`) },
      });
    }
  }
  return entries;
}
