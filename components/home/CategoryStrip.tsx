import { getTranslations } from "next-intl/server";
import { CategoryOrbit } from "@/components/home/CategoryOrbit";
import type { Locale } from "@/types/locale";

const CATEGORIES = [
  { slug: "arrangements", img: "/products/flamingo-garden.jpg", index: "01" },
  { slug: "bouquets", img: "/products/dozen-roses-bouquet.jpg", index: "02" },
  { slug: "plants", img: "/products/monstera-mood.jpg", index: "03" },
  { slug: "gifts", img: "/products/daydream-parcel.jpg", index: "04" },
  { slug: "sympathy", img: "/products/celestial-peace.jpg", index: "05" },
  { slug: "subscriptions", img: "/products/timeless-romance.jpg", index: "06" },
] as const;

export async function CategoryStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations();

  const items = CATEGORIES.map((c) => ({
    slug: c.slug,
    img: c.img,
    index: c.index,
    name: t(`categories.${c.slug}`),
    href: `/${locale}/shop/${c.slug}`,
  }));

  const eyebrow =
    locale === "es"
      ? "La Colección · 06 Categorías"
      : "The Collection · 06 Categories";
  const hoverHint =
    locale === "es" ? "[pasa el cursor para entrar]" : "[hover to enter]";
  const shopLabel = locale === "es" ? "Ver" : "Shop";

  return (
    <CategoryOrbit
      title={t("home.categories_title")}
      eyebrow={eyebrow}
      hoverHint={hoverHint}
      shopLabel={shopLabel}
      items={items}
    />
  );
}
