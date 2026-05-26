import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

const COPY = {
  eyebrow: { en: "Sympathy & memorials", es: "Pésame y memoriales" },
  title: {
    en: "When words are not enough, we coordinate the rest.",
    es: "Cuando las palabras no bastan, coordinamos lo demás.",
  },
  body: {
    en: "Custom funeral arrangements and memorial installations, delivered directly to Long Island and Queens funeral homes. Most pieces are designed and coordinated by phone — call us and we'll handle the rest within 15 minutes.",
    es: "Arreglos funerarios y memoriales a medida, entregados directamente a funerarias de Long Island y Queens. La mayoría de las piezas se diseñan y coordinan por teléfono — llámanos y nos encargamos en menos de 15 minutos.",
  },
  call: { en: "Call now", es: "Llamar ahora" },
  inquire: { en: "Send an inquiry", es: "Enviar consulta" },
} as const;

export function SympathyHero({ locale }: { locale: Locale }) {
  return (
    <header className="relative isolate overflow-hidden bg-ink text-bone">
      <Image
        src="/sympathy/hero-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[80%_center] md:object-[70%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/10"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink to-transparent"
      />
      <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-20 md:pt-32 md:pb-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70">
          {COPY.eyebrow[locale]}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.95] tracking-tighter md:text-7xl">
          {COPY.title[locale]}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-bone/80 md:text-lg">
          {COPY.body[locale]}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={SITE.phoneHref}
            className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3 font-sans text-base font-medium text-ink transition-colors hover:bg-bone/90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {COPY.call[locale]} · {SITE.phoneDisplay}
          </a>
          <Link
            href="#inquire"
            className="inline-flex items-center gap-2 rounded-full border border-bone/30 px-6 py-3 font-sans text-base text-bone transition-colors hover:bg-bone/10"
          >
            {COPY.inquire[locale]} →
          </Link>
        </div>
      </div>
    </header>
  );
}
