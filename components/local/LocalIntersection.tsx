import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";
import type { LocalCity, LocalOccasion } from "@/data/local-seo";
import { getIntersection } from "@/data/local-seo";

/** The paragraph that exists only where this town meets this occasion. */
export function LocalIntersection({
  locale,
  city,
  occasion,
}: {
  locale: Locale;
  city: LocalCity;
  occasion: LocalOccasion;
}) {
  const note = getIntersection(city.slug, occasion.slug);
  if (!note) return null;
  const es = locale === "es";

  return (
    <section className="border-t border-ink/10 bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/50">
            {city.name}, NY · {occasion.label[locale]}
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight md:text-4xl">
            {es
              ? `Lo que cambia en ${city.name}`
              : `What changes in ${city.name}`}
          </h2>
          <p className="mt-6 max-w-3xl font-sans text-lg leading-relaxed text-bone/80">
            {note[locale]}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
