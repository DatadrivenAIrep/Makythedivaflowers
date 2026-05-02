import type { Locale } from "@/types/locale";

export type Localized = { en: string; es: string };

export type ProductCategory =
  | "arrangements"
  | "bouquets"
  | "plants"
  | "gifts"
  | "sympathy"
  | "subscriptions";

export type ProductImage = {
  src: string;
  alt: Localized;
  aspect: "4/5" | "1/1" | "16/9";
};

export type ProductVariant = {
  id: string;
  label: Localized;
  priceCents: number;
  subtitle?: Localized;
};

export type ProductAddOn = {
  id: string;
  label: Localized;
  priceCents: number;
};

export type ProductTag = "new" | "same-day" | "staff-pick" | "seasonal";
export type Occasion =
  | "birthday"
  | "anniversary"
  | "sympathy"
  | "romance"
  | "congrats"
  | "just-because";
export type ColorFamily =
  | "pink"
  | "red"
  | "white"
  | "mixed"
  | "green"
  | "pastel";

export type SubscriptionCadence = "weekly" | "biweekly";

export type Product = {
  id: string;
  slug: string;
  title: Localized;
  category: ProductCategory;
  blurb: Localized;
  description: Localized;
  images: ProductImage[];
  variants: ProductVariant[];
  addOns?: ProductAddOn[];
  tags: ProductTag[];
  occasions: Occasion[];
  colorFamily: ColorFamily[];
  active: boolean;
  subscription?: { cadences: SubscriptionCadence[] };
  pairsWith?: string[];
  seo: {
    title: Localized;
    description: Localized;
  };
};

export function pickLocalized(value: Localized, locale: Locale): string {
  return value[locale];
}
