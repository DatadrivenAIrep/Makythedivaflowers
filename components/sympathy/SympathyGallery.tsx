import Image from "next/image";
import type { Locale } from "@/types/locale";
import { SYMPATHY_PIECES, SYMPATHY_FORMS } from "@/data/sympathy-pieces";

const COPY = {
  eyebrow: { en: "Recent work", es: "Trabajos recientes" },
  title: { en: "Pieces we've made.", es: "Piezas que hemos hecho." },
  body: {
    en: "Each commission is one-of-one. Forms, scale, and palette adjusted to the service. Tap a piece to start an inquiry referencing it.",
    es: "Cada encargo es único. Forma, escala y paleta ajustadas al servicio. Toca una pieza para iniciar una consulta sobre ella.",
  },
  inquire: { en: "Coordinate this →", es: "Coordinar esta →" },
} as const;

export function SympathyGallery({ locale }: { locale: Locale }) {
  return (
    <section className="bg-ink/[0.97] py-20 text-bone md:py-28">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <header className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
            {COPY.eyebrow[locale]}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1] tracking-tighter md:text-5xl">
            {COPY.title[locale]}
          </h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-bone/75">
            {COPY.body[locale]}
          </p>
        </header>
        <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SYMPATHY_PIECES.map((piece) => {
            const formLabel = SYMPATHY_FORMS[piece.form][locale];
            return (
              <li
                key={piece.slug}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-bento)] border border-bone/10 bg-ink/60"
              >
                <a
                  href={`#inquire?piece=${piece.slug}`}
                  className="relative block aspect-[4/5] w-full overflow-hidden"
                  data-piece-slug={piece.slug}
                  data-piece-title={piece.title[locale]}
                >
                  <Image
                    src={piece.image}
                    alt={piece.title[locale]}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-bone/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-bone backdrop-blur">
                    {formLabel}
                  </span>
                </a>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl leading-tight tracking-tight text-bone">
                    {piece.title[locale]}
                  </h3>
                  <p className="mt-3 flex-1 font-sans text-sm leading-relaxed text-bone/75">
                    {piece.blurb[locale]}
                  </p>
                  <a
                    href={`#inquire?piece=${piece.slug}`}
                    className="mt-5 inline-flex w-fit items-center gap-2 font-sans text-sm text-bone underline-offset-4 hover:underline"
                  >
                    {COPY.inquire[locale]}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
