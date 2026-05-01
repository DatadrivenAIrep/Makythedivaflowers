import { getTranslations } from "next-intl/server";
import { CategoryOrbit } from "@/components/home/CategoryOrbit";
import type { Locale } from "@/types/locale";

const CATEGORIES = [
  { slug: "arrangements", seed: "cat-arrangements", index: "01" },
  { slug: "bouquets", seed: "cat-bouquets", index: "02" },
  { slug: "plants", seed: "cat-plants", index: "03" },
  { slug: "gifts", seed: "cat-gifts", index: "04" },
  { slug: "sympathy", seed: "cat-sympathy", index: "05" },
  { slug: "subscriptions", seed: "cat-subscriptions", index: "06" },
] as const;

export async function CategoryStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations();

  const items = CATEGORIES.map((c) => ({
    slug: c.slug,
    seed: c.seed,
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
