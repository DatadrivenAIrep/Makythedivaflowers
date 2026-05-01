import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";

const CATEGORIES = [
  { slug: "arrangements", seed: "cat-arrangements" },
  { slug: "bouquets", seed: "cat-bouquets" },
  { slug: "plants", seed: "cat-plants" },
  { slug: "gifts", seed: "cat-gifts" },
  { slug: "sympathy", seed: "cat-sympathy" },
  { slug: "subscriptions", seed: "cat-subscriptions" },
] as const;

export async function CategoryStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6 flex items-end justify-between mb-8">
        <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-none">
          {t("home.categories_title")}
        </h2>
      </div>
      <div className="overflow-x-auto snap-x snap-mandatory pl-6 pb-4 scrollbar-thin">
        <ul className="flex gap-5 pr-6 max-w-[1400px] mx-auto">
          {CATEGORIES.map((c) => (
            <li
              key={c.slug}
              className="snap-start shrink-0 w-[78vw] sm:w-[44vw] md:w-[28vw] lg:w-[22vw]"
            >
              <Link
                href={`/${locale}/shop/${c.slug}`}
                className="group block space-y-4"
              >
                <BloomImage
                  src={`https://picsum.photos/seed/${c.seed}/600/750`}
                  alt={t(`categories.${c.slug}`)}
                  className="aspect-[4/5] rounded-[var(--radius-product)]"
                />
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl tracking-tighter">
                    {t(`categories.${c.slug}`)}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-mute-500 group-hover:text-rouge transition-colors">
                    Shop →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
