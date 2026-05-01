import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Locale } from "@/types/locale";
import { getProductBySlug, getPairsWith, PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { ImageStack } from "@/components/product/ImageStack";
import { PdpConfigurator } from "@/components/product/PdpConfigurator";
import { PdpAccordion } from "@/components/product/PdpAccordion";
import { PairsWellWith } from "@/components/product/PairsWellWith";
import { JournalTile } from "@/components/product/JournalTile";
import { PdpStructuredData } from "@/components/product/PdpStructuredData";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";

export async function generateStaticParams() {
  return PRODUCTS.filter((p) => p.active).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = getProductBySlug(slug);
  if (!p) return {};
  return {
    title: p.seo.title[locale],
    description: p.seo.description[locale],
    alternates: {
      canonical: `/${locale}/product/${slug}`,
      languages: {
        en: `/en/product/${slug}`,
        es: `/es/product/${slug}`,
      },
    },
    openGraph: {
      title: p.seo.title[locale],
      description: p.seo.description[locale],
      images: p.images[0]?.src ? [p.images[0].src] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);
  if (!product || !product.active) notFound();
  setRequestLocale(locale);

  const isSympathy = product.category === "sympathy";
  const pairs = getPairsWith(product);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const eyebrow =
    locale === "es"
      ? `Diva Flowers · ${categoryLabel(product.category, "es")}`
      : `Diva Flowers · ${categoryLabel(product.category, "en")}`;

  return (
    <main className="bg-bone text-ink">
      <PdpStructuredData product={product} locale={locale} origin={origin} />
      <BreadcrumbListLD
        items={[
          { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
          { name: locale === "es" ? "Tienda" : "Shop", href: `/${locale}/shop` },
          { name: categoryLabel(product.category, locale), href: `/${locale}/shop/${product.category}` },
          { name: product.title[locale], href: `/${locale}/product/${product.slug}` },
        ]}
      />

      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-10 px-6 pt-10 pb-16 lg:grid-cols-12 lg:gap-12 lg:pt-16">
        <div className="lg:col-span-7">
          <ImageStack product={product} locale={locale} />
        </div>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tighter md:text-6xl">
              {product.title[locale]}
            </h1>
            <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-ink/75">
              {product.blurb[locale]}
            </p>

            <PdpConfigurator
              product={product}
              locale={locale}
              cutoff={SITE.cutoff24}
              motionMode={isSympathy ? "sympathy" : "default"}
            />

            <div className="mt-8">
              <PdpAccordion />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-16">
        <PairsWellWith products={pairs} locale={locale} />
      </section>

      {!isSympathy && (
        <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
          <JournalTile locale={locale} />
        </section>
      )}
    </main>
  );
}

function categoryLabel(c: string, locale: "en" | "es"): string {
  const map: Record<string, { en: string; es: string }> = {
    arrangements: { en: "Arrangements", es: "Arreglos" },
    bouquets: { en: "Bouquets", es: "Ramos" },
    plants: { en: "Plants", es: "Plantas" },
    gifts: { en: "Gifts", es: "Regalos" },
    sympathy: { en: "Sympathy", es: "Condolencias" },
    subscriptions: { en: "Subscriptions", es: "Suscripciones" },
  };
  return map[c]?.[locale] ?? c;
}
