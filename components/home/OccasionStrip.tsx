import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";
import { StaggerGroup, StaggerItem } from "@/components/motion/StaggerGroup";
import { OCCASION_LINKS } from "@/lib/occasions-nav";
import type { Locale } from "@/types/locale";

/**
 * "Shop by occasion" — the entry point every competing Long Island florist puts
 * above the fold and this site was missing. People arrive with an occasion in
 * mind ("it's her birthday", "there's a service Thursday"), not a product type,
 * so this sits directly under the hero, ahead of the category orbit.
 *
 * Each tile deep-links into the shop already filtered by that occasion; sympathy
 * goes to its own landing page instead. See `lib/occasions-nav.ts`.
 */
export async function OccasionStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.occasions");

  return (
    <section
      aria-labelledby="occasion-strip-title"
      className="mx-auto max-w-[var(--container-max)] px-6 pt-20 pb-4 md:pt-28"
    >
      <div className="mb-8 flex flex-col gap-3 md:mb-11">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
          {t("eyebrow")}
        </span>
        <h2
          id="occasion-strip-title"
          className="font-display text-4xl leading-[0.95] tracking-tighter md:text-6xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30" }}
        >
          {t("title")}
        </h2>
      </div>

      <StaggerGroup
        as="ul"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-7"
      >
        {OCCASION_LINKS.map((o) => (
          <StaggerItem as="li" key={o.slug}>
            <Link
              href={o.path(locale)}
              className="group block rounded-[var(--radius-product)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            >
              <div className="relative aspect-[3/4] rounded-[var(--radius-product)] bg-mute-100">
                <FloatingPhoto
                  src={o.img}
                  alt=""
                  sizes="(min-width: 1024px) 200px, (min-width: 640px) 33vw, 50vw"
                  className="inset-x-2 top-3 bottom-2 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 motion-reduce:transform-none"
                />
              </div>
              <span className="mt-2.5 block font-display text-lg leading-tight tracking-tight text-ink transition-colors group-hover:text-rouge md:text-xl">
                {o.label[locale]}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
