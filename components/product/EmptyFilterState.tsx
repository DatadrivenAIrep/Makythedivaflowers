import Link from "next/link";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
  resetHref: string;
};

export function EmptyFilterState({ locale, resetHref }: Props) {
  const title = locale === "es" ? "Nada coincide aún." : "Nothing matches yet.";
  const body =
    locale === "es"
      ? "Prueba con menos filtros, o explora todas nuestras flores."
      : "Try fewer filters, or browse everything we're growing.";
  const cta = locale === "es" ? "Ver todo" : "Browse all";

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Sin resultados" : "No results"}
      </p>
      <h2 className="mt-3 font-display text-4xl tracking-tighter text-ink md:text-5xl">
        {title}
      </h2>
      <p className="mt-3 max-w-md font-sans text-base leading-relaxed text-ink/75">
        {body}
      </p>
      <Link
        href={resetHref}
        className="mt-6 inline-flex h-11 items-center rounded-full border border-ink/20 px-5 font-sans text-sm tracking-tight text-ink hover:border-ink/45"
      >
        {cta}
      </Link>
    </div>
  );
}
