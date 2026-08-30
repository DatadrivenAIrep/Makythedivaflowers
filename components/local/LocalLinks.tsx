import Link from "next/link";
import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";
import { LOCAL_CITIES, LOCAL_OCCASIONS, getIntersection, type LocalCity } from "@/data/local-seo";

/**
 * Internal linking. Every local page links to its siblings — the occasions for
 * this town, and the same occasion in neighbouring towns. That mesh is what
 * gets the deeper pages crawled at all.
 */
export function LocalLinks({
  locale,
  city,
  currentOccasion,
}: {
  locale: Locale;
  city: LocalCity;
  currentOccasion?: string;
}) {
  const es = locale === "es";
  const base = `/${locale}/flower-delivery`;
  const otherCities = LOCAL_CITIES.filter((c) => c.slug !== city.slug);

  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <Reveal>
          <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
            {es ? `Más en ${city.name}` : `More in ${city.name}`}
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LOCAL_OCCASIONS.filter((o) => o.slug !== currentOccasion).map((o) => {
              const note = getIntersection(city.slug, o.slug);
              const teaser = note ? `${note[locale].split(/(?<=\.)\s/)[0]}` : null;
              return (
                <li key={o.slug}>
                  <Link
                    href={`${base}/${city.slug}/${o.slug}`}
                    className="flex h-full flex-col rounded-2xl border border-ink/10 p-5 transition-[border-color,transform] [transition-duration:var(--motion-fast)] hover:border-ink/30 active:scale-[0.99]"
                  >
                    <span className="font-display text-xl leading-tight">{o.label[locale]}</span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-mute-500">
                      {city.name}, NY
                    </span>
                    {teaser && (
                      <span className="mt-3 block font-sans text-sm leading-relaxed text-ink/65">
                        {teaser}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <h2 className="mt-16 font-display text-3xl leading-tight tracking-tight md:text-4xl">
            {es ? "Pueblos vecinos" : "Nearby towns"}
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={currentOccasion ? `${base}/${c.slug}/${currentOccasion}` : `${base}/${c.slug}`}
                  className="inline-block rounded-full border border-ink/15 px-4 py-2 font-sans text-sm text-ink/75 transition-[border-color,color] [transition-duration:var(--motion-fast)] hover:border-ink/40 hover:text-ink"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
