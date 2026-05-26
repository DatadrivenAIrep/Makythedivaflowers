import type { Locale } from "@/types/locale";

const COPY = {
  eyebrow: { en: "How it works", es: "Cómo lo hacemos" },
  title: {
    en: "One call. We handle the rest.",
    es: "Una llamada. Nosotros nos encargamos.",
  },
  steps: [
    {
      title: { en: "01 — You call", es: "01 — Llamas" },
      body: {
        en: "Tell us the funeral home, the date and time of service, and what you have in mind. If you're not sure, we'll guide the choice in two minutes.",
        es: "Cuéntanos la funeraria, fecha y hora del servicio, y qué tienes en mente. Si no estás seguro, te guiamos en dos minutos.",
      },
    },
    {
      title: { en: "02 — We design", es: "02 — Diseñamos" },
      body: {
        en: "We send a short confirmation with the form, flower palette, and sash text. Adjustments by text until you approve.",
        es: "Enviamos una confirmación breve con la forma, paleta floral y texto de la banda. Ajustes por mensaje hasta que apruebes.",
      },
    },
    {
      title: { en: "03 — We deliver", es: "03 — Entregamos" },
      body: {
        en: "Direct to the funeral home, on time, set up where the family wants it. No prop, no fuss, no late arrival.",
        es: "Directo a la funeraria, a tiempo, ubicado donde la familia lo pida. Sin escenografías, sin demoras.",
      },
    },
  ],
} as const;

export function SympathyProcess({ locale }: { locale: Locale }) {
  return (
    <section className="bg-bone py-20 md:py-24">
      <div className="mx-auto max-w-[var(--container-max)] px-6">
        <header className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {COPY.eyebrow[locale]}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1] tracking-tighter text-ink md:text-5xl">
            {COPY.title[locale]}
          </h2>
        </header>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {COPY.steps.map((step) => (
            <li
              key={step.title.en}
              className="rounded-[var(--radius-bento)] border border-ink/10 bg-bone/60 p-8"
            >
              <h3 className="font-display text-2xl leading-tight tracking-tight text-ink">
                {step.title[locale]}
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-ink/75">
                {step.body[locale]}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
