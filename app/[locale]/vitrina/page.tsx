import type { Metadata } from "next";
import Showcase from "@/components/tv-showcase/Showcase";
import { buildShowcase, type TvSlide } from "@/lib/tv-showcase";
import { getTvVisibility } from "@/lib/tv-showcase-storage";
import { getPricedProducts } from "@/lib/product-prices";
import { getAllImageOverrides, applyImageOverrides, type ImageOverride } from "@/lib/product-images";
import { getSalesRanking } from "@/lib/product-sales";
import { qrSvgDataUri } from "@/lib/digital-card-qr";

// Every load reads today's prices, photos, sales and Maky's TV choices.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vitrina · Diva Flowers",
  robots: { index: false, follow: false },
};

function imageOverrides(): ImageOverride[] {
  try {
    return getAllImageOverrides();
  } catch (err) {
    // Catalog photos beat a blank TV.
    console.error("[vitrina] image overrides unavailable", err);
    return [];
  }
}

export default async function VitrinaPage() {
  const products = applyImageOverrides(getPricedProducts(), imageOverrides());
  const showcase = buildShowcase(products, {
    visibility: getTvVisibility(),
    sales: getSalesRanking(),
  });
  const slides: TvSlide[] = await Promise.all(
    showcase.map(async (s) => ({ ...s, qr: await qrSvgDataUri(s.url) })),
  );
  return <Showcase slides={slides} />;
}
