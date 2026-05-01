import Link from "next/link";
import type { Locale } from "@/types/locale";

export function JournalTile({ locale }: { locale: Locale }) {
  const eyebrow = locale === "es" ? "Del diario" : "From our journal";
  const title =
    locale === "es"
      ? "Cómo construimos un Altar Rubí, paso a paso."
      : "How we build a Ruby Altar, stem by stem.";
  const cta = locale === "es" ? "Leer" : "Read";
  return (
    <Link
      href={`/${locale}/journal`}
      className="group relative flex flex-col items-start justify-between overflow-hidden rounded-[var(--radius-bento)] bg-lilac p-8 transition-colors hover:bg-lilac/90 md:flex-row md:items-end md:p-12"
    >
      <div className="max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink/70">{eyebrow}</p>
        <p className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink md:text-4xl">
          {title}
        </p>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-ink md:mt-0">
        {cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
