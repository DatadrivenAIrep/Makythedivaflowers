import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

const COPY = {
  eyebrow: { en: "For funeral homes & directors", es: "Para funerarias y directores" },
  title: {
    en: "Partner with Maky for the families you serve.",
    es: "Sé partner de Maky para las familias a las que sirves.",
  },
  body: {
    en: "We work with Long Island and Queens funeral homes as ongoing partners — exclusive partner pricing, same-day coordination with the family, and one direct line for every service.",
    es: "Trabajamos con funerarias de Long Island y Queens como partners en curso — precios exclusivos de partner, coordinación el mismo día con la familia y una línea directa para cada servicio.",
  },
  perks: [
    {
      en: "Exclusive partner discount",
      es: "Descuento exclusivo de partner",
    },
    {
      en: "Same-day coordination with the family",
      es: "Coordinación el mismo día con la familia",
    },
    {
      en: "One point of contact, every time",
      es: "Un punto de contacto, siempre",
    },
  ],
  call_label: {
    en: "Funeral home line · same number",
    es: "Línea funerarias · mismo número",
  },
  mention: {
    en: "Mention you're a funeral home when you call so we activate partner pricing.",
    es: "Menciona que eres funeraria al llamar para activar precios de partner.",
  },
} as const;

export function SympathyFuneralHomes({ locale }: { locale: Locale }) {
  return (
    <section className="bg-bone py-20 md:py-24">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <div className="rounded-[var(--radius-bento)] border border-ink/15 bg-bone/60 p-8 md:p-12">
          <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
                {COPY.eyebrow[locale]}
              </p>
              <h2 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight text-ink md:text-4xl">
                {COPY.title[locale]}
              </h2>
              <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-ink/75">
                {COPY.body[locale]}
              </p>
              <ul className="mt-7 space-y-3">
                {COPY.perks.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 font-sans text-[15px] text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-rouge"
                    />
                    {p[locale]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius-product)] border border-ink/10 bg-ink p-7 text-bone md:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
                {COPY.call_label[locale]}
              </p>
              <a
                href={SITE.phoneHref}
                className="mt-2 block font-mono text-3xl text-bone transition-colors hover:text-rouge md:text-4xl"
              >
                {SITE.phoneDisplay}
              </a>
              <p className="mt-5 font-sans text-sm leading-relaxed text-bone/75">
                {COPY.mention[locale]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
