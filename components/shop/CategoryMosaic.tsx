import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BloomImage } from "@/components/motion/BloomImage";
import { StaggerGroup, StaggerItem } from "@/components/motion/StaggerGroup";
import type { Locale } from "@/types/locale";

const TILES: { slug: string; seed: string; col: string; row: string; aspect: string }[] = [
  { slug: "arrangements", seed: "cat-arrangements", col: "md:col-span-7", row: "md:row-span-2", aspect: "aspect-[7/8]" },
  { slug: "bouquets", seed: "cat-bouquets", col: "md:col-span-5", row: "md:row-span-1", aspect: "aspect-[5/4]" },
  { slug: "plants", seed: "cat-plants", col: "md:col-span-5", row: "md:row-span-1", aspect: "aspect-[5/4]" },
  { slug: "gifts", seed: "cat-gifts", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
  { slug: "sympathy", seed: "cat-sympathy", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
  { slug: "subscriptions", seed: "cat-subscriptions", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
];

export async function CategoryMosaic({ locale }: { locale: Locale }) {
  const t = await getTranslations("categories");
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pb-20">
      <StaggerGroup className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {TILES.map((tile) => {
          const name = t(tile.slug as Parameters<typeof t>[0]);
          return (
            <StaggerItem key={tile.slug} className={`${tile.col} ${tile.row}`}>
              <Link
                href={`/${locale}/shop/${tile.slug}`}
                className={`group relative overflow-hidden rounded-[var(--radius-bento)] bg-mute-100 block ${tile.aspect}`}
              >
                <BloomImage
                  src={`https://picsum.photos/seed/${tile.seed}/1400/1400`}
                  alt={name}
                  className="h-full w-full"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between">
                  <h2 className="font-display text-3xl leading-none tracking-tighter text-bone md:text-4xl">
                    {name}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bone/85">
                    {locale === "es" ? "Ver →" : "Shop →"}
                  </span>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}
