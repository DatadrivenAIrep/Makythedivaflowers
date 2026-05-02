import { getTranslations } from "next-intl/server";
import { BentoFeaturedTile } from "./BentoFeaturedTile";
import { BentoSubscriptionsTile } from "./BentoSubscriptionsTile";
import { BentoLiveStatusTile } from "./BentoLiveStatusTile";
import { BentoPressTile } from "./BentoPressTile";
import { BentoStudioClock } from "./BentoStudioClock";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";

const FEATURED_SLUG = "a-thousand-heartbeats";

export async function BentoGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento");
  const featured = PRODUCTS.find((p) => p.slug === FEATURED_SLUG) ?? PRODUCTS[0];
  const featuredImage = featured.images[0];
  const featuredPriceUSD = Math.round(featured.variants[0].priceCents / 100);

  return (
    <section className="max-w-[1400px] mx-auto px-6 py-24 md:py-32">
      <div className="flex items-end justify-between mb-10 md:mb-14">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
            {t("console_eyebrow")}
          </span>
          <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-[0.95]">
            {t("console_title")}
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-rouge" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
            SYSTEM ACTIVE
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5"
        style={{ gridAutoRows: "minmax(140px, auto)" }}
      >
        <div className="md:col-span-2 md:row-span-3">
          <BentoFeaturedTile
            locale={locale}
            slug={featured.slug}
            title={featured.title[locale]}
            imageSrc={featuredImage.src}
            imageAlt={featuredImage.alt[locale]}
            priceUSD={featuredPriceUSD}
          />
        </div>
        <div className="md:col-span-2 md:row-span-2">
          <BentoLiveStatusTile />
        </div>
        <div className="md:col-span-1">
          <BentoSubscriptionsTile locale={locale} />
        </div>
        <div className="md:col-span-1">
          <BentoStudioClock />
        </div>
        <div className="md:col-span-4">
          <BentoPressTile />
        </div>
      </div>
    </section>
  );
}
