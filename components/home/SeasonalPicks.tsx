import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { seasonalPicks } from "@/lib/seasonal-picks";
import type { Locale } from "@/types/locale";

/**
 * "What are you looking for?" — a row of round photo chips for the things
 * customers ask for by name: roses, the running season, the next holiday.
 * Compact on purpose: it sits right under the hero and must not push the
 * first price further down. On phones the row swipes sideways. See
 * `lib/seasonal-picks.ts` for what shows when.
 */
export async function SeasonalPicks({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.picks");

  return (
    <section
      aria-labelledby="seasonal-picks-title"
      className="mx-auto max-w-[var(--container-max)] px-6 pt-10 md:pt-14"
    >
      <h2
        id="seasonal-picks-title"
        className="mb-5 font-display text-2xl leading-tight tracking-tight md:text-3xl"
      >
        {t("title")}
      </h2>

      <ul className="-mx-6 flex snap-x snap-mandatory scroll-pl-6 gap-3 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {seasonalPicks().map((p) => (
          <li key={p.slug} className="shrink-0 snap-start">
            <Link
              href={p.path(locale)}
              className="group flex items-center gap-3.5 rounded-full bg-white py-2 pr-6 pl-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-mute-100">
                <Image
                  src={p.img}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
                />
              </span>
              <span className="whitespace-nowrap">
                {p.badge && (
                  <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.15em] text-rouge">
                    {p.badge[locale]}
                  </span>
                )}
                <span className="block font-display text-lg leading-tight tracking-tight text-ink transition-colors group-hover:text-rouge">
                  {p.label[locale]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
