// app/sitemap.ts
import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/data/products";
import { locales } from "@/types/locale";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://divaflowers.com";
const STATIC_PATHS = [
  "",
  "/shop",
  "/shop/arrangements",
  "/shop/bouquets",
  "/shop/plants",
  "/shop/gifts",
  "/shop/sympathy",
  "/shop/subscriptions",
  "/weddings",
  "/events",
  "/story",
  "/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  const lastModified = new Date();
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      out.push({ url: `${SITE_URL}/${locale}${path}`, lastModified });
    }
    for (const p of PRODUCTS) {
      if (!p.active) continue;
      out.push({ url: `${SITE_URL}/${locale}/product/${p.slug}`, lastModified });
    }
  }
  return out;
}
