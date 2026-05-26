import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

const COPY = {
  eyebrow: { en: "Direct coordination", es: "Coordinación directa" },
  title: {
    en: "We work with Long Island and Queens funeral homes daily.",
    es: "Trabajamos con funerarias de Long Island y Queens a diario.",
  },
  body: {
    en: "Same-day setup is possible for most local services if you call before 11am the day of. We deliver, set the piece where the family wants it, and confirm with a photo when we leave.",
    es: "Entrega y montaje el mismo día son posibles para la mayoría de servicios locales si llamas antes de las 11am del día. Entregamos, ubicamos la pieza donde la familia quiera, y confirmamos con una foto al salir.",
  },
  call_label: { en: "Or call us", es: "O llámanos" },
  cell_label: { en: "Mobile / text", es: "Móvil / texto" },
} as const;

export function SympathyTrust({ locale }: { locale: Locale }) {
  return (
    <section className="bg-ink py-20 text-bone md:py-24">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <div className="rounded-[var(--radius-bento)] border border-bone/10 bg-bone/[0.04] p-8 md:p-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
            {COPY.eyebrow[locale]}
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl leading-[1.05] tracking-tight md:text-5xl">
            {COPY.title[locale]}
          </h2>
          <p className="mt-5 max-w-2xl font-sans text-base leading-relaxed text-bone/75">
            {COPY.body[locale]}
          </p>
          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
                {COPY.call_label[locale]}
              </dt>
              <dd className="mt-2">
                <a
                  href={SITE.phoneHref}
                  className="font-mono text-2xl text-bone transition-colors hover:text-rouge md:text-3xl"
                >
                  {SITE.phoneDisplay}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
                {COPY.cell_label[locale]}
              </dt>
              <dd className="mt-2">
                <a
                  href={SITE.mobile.tel}
                  className="font-mono text-2xl text-bone transition-colors hover:text-rouge md:text-3xl"
                >
                  {SITE.mobile.display}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
