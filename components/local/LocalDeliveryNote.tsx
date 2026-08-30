import type { Locale } from "@/types/locale";
import { Reveal } from "@/components/motion/Reveal";
import type { LocalCity } from "@/data/local-seo";

/** The one paragraph that is true of this town and no other. */
export function LocalDeliveryNote({ locale, city }: { locale: Locale; city: LocalCity }) {
  const es = locale === "es";
  const kindLabel = es
    ? { village: "pueblo incorporado", hamlet: "hamlet", cluster: "conjunto de pueblos" }[city.kind]
    : { village: "incorporated village", hamlet: "hamlet", cluster: "cluster of villages" }[city.kind];

  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
      <Reveal>
        <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-16">
          <div>
            <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
              {es ? `Entregar en ${city.name}` : `Delivering to ${city.name}`}
            </h2>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-mute-500">
              {kindLabel} · Nassau County, NY
            </p>
          </div>
          <div className="max-w-2xl">
            <p className="font-sans text-lg leading-relaxed text-ink/85">{city.note[locale]}</p>
            <p className="mt-6 font-sans text-base leading-relaxed text-ink/65">
              {es
                ? `También entregamos a diario en ${city.neighbors.slice(0, -1).join(", ")} y ${city.neighbors.slice(-1)}.`
                : `We deliver daily to ${city.neighbors.slice(0, -1).join(", ")} and ${city.neighbors.slice(-1)} as well.`}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
