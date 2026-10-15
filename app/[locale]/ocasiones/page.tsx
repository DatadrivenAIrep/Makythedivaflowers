import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/types/product";
import { OCCASIONS_ALL, OCCASION_CONTENT } from "@/data/occasion-content";
import { EXOTIC_LINK, OCCASION_NAV, occasionLinks } from "@/lib/occasions-nav";
import { PRODUCTS } from "@/data/products";
import { filterProducts } from "@/data/product-helpers";
import { productsInShopCategory, type ShopSlug } from "@/lib/shop-categories";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";
import { StaggerGroup, StaggerItem } from "@/components/motion/StaggerGroup";
import { Grain } from "@/components/brand/Grain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const es = locale === "es";
  return {
    title: es
      ? "Flores por Ocasión | Long Island | Diva Flowers"
      : "Flowers by Occasion | Long Island | Diva Flowers",
    description: es
      ? "Cumpleaños, aniversario, condolencias, graduación, recién nacido y más. Arreglos hechos a mano en Albertson con entrega el mismo día en Nassau y Queens."
      : "Birthday, anniversary, sympathy, graduation, new baby and more. Hand-built arrangements from our Albertson studio with same-day delivery across Nassau and Queens.",
    alternates: localeAlternates(locale, "/ocasiones"),
  };
}

/** Photo for an occasion: the nav list carries one for every occasion but Mother's Day. */
const IMG_BY_SLUG = new Map(OCCASION_NAV.map((o) => [o.slug as string, o.img]));

const FALLBACK_IMG: Partial<Record<Occasion, string>> = {
  "mothers-day": "/products/blush-enchantment.jpg",
};

export default async function OccasionsIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const es = locale === "es";

  type Card = { slug: string; label: { en: string; es: string }; count: number; img: string; href: string };
  const items: Card[] = OCCASIONS_ALL.map((slug) => ({
    slug,
    label: OCCASION_CONTENT[slug].label,
    count: filterProducts(PRODUCTS, { occasion: slug }).length,
    img: IMG_BY_SLUG.get(slug) ?? FALLBACK_IMG[slug] ?? "/products/designers-choice.png",
    // Sympathy keeps its own dedicated page.
    href: slug === "sympathy" ? `/${locale}/sympathy` : `/${locale}/ocasiones/${slug}`,
  }));
  // Not occasions, but people shop them the same way: the seasonal collection
  // (fall, Christmas, Valentine's) when one runs and the exotics get cards alongside.
  for (const link of occasionLinks().slice(OCCASION_NAV.length)) {
    items.push({
      slug: link.slug,
      label: link.label,
      // Each extra link is named after the shop collection it opens.
      count: productsInShopCategory(PRODUCTS, link.slug as ShopSlug).length,
      img: link.img,
      href: link.path(locale),
    });
  }

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: es ? "Ocasiones" : "Occasions", href: `/${locale}/ocasiones` },
        ]}
      />
      <Grain />

      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10 md:pt-24 md:pb-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
          {es ? "Compra por ocasión" : "Shop by occasion"}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.98] tracking-tighter md:text-6xl">
          {es ? "¿Cuál es la ocasión?" : "What is the occasion?"}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-ink/75">
          {es
            ? "Cada ocasión tiene su propia página, con lo que recomendamos mandar y las preguntas que más nos hacen por teléfono."
            : "Every occasion has its own page, with what we would send and the questions people actually call to ask."}
        </p>
      </header>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
        <StaggerGroup
          as="ul"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {items.map((it) => (
            <StaggerItem as="li" key={it.slug}>
              <Link
                href={it.href}
                className="group block rounded-[var(--radius-product)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
              >
                {/* Whole arrangement floating on plaster; label + count below. */}
                <div className="relative aspect-[4/5] rounded-[var(--radius-product)] bg-mute-100">
                  <FloatingPhoto
                    src={it.img}
                    alt=""
                    sizes="(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw"
                    className="inset-x-3 top-4 bottom-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 motion-reduce:transform-none"
                  />
                </div>
                <span className="mt-3 block font-display text-xl leading-tight tracking-tight text-ink transition-colors group-hover:text-rouge">
                  {it.label[locale]}
                </span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
                  {it.count} {es ? "diseños" : "designs"}
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>
    </main>
  );
}
