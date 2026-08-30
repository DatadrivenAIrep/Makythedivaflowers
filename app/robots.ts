import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { locales } from "@/types/locale";

// Transactional + private routes. They have no search value, they burn crawl
// budget, and cart/checkout URLs carry state that should never be indexed.
const PRIVATE_PATHS = ["account", "cart", "checkout", "order", "admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        ...locales.flatMap((l) => PRIVATE_PATHS.map((p) => `/${l}/${p}/`)),
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
