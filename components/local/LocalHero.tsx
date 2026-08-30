import Link from "next/link";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import type { LocalCity } from "@/data/local-seo";

/**
 * The H1 on every local page names the service and the town, in that order —
 * that is the whole point of the page. The brand tagline stays on the homepage.
 */
export function LocalHero({
  locale,
  city,
  eyebrow,
  heading,
  body,
}: {
  locale: Locale;
  city: LocalCity;
  eyebrow: string;
  heading: string;
  body: string;
}) {
  const es = locale === "es";
  return (
    <header className="relative isolate overflow-hidden bg-ink text-bone">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.10),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[0.98] tracking-tighter md:text-6xl">
          {heading}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-bone/80 md:text-lg">
          {body}
        </p>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 font-mono text-[11px] uppercase tracking-[0.14em] text-bone/70">
          <div>
            <dt className="text-bone/45">{es ? "Desde el estudio" : "From the studio"}</dt>
            <dd className="mt-1 text-bone">
              {es ? `~${city.miles} millas · ${city.driveMinutes} min` : `~${city.miles} mi · ${city.driveMinutes} min`}
            </dd>
          </div>
          <div>
            <dt className="text-bone/45">{es ? "Códigos postales" : "ZIP codes served"}</dt>
            <dd className="mt-1 text-bone">{city.zips.join(" · ")}</dd>
          </div>
          <div>
            <dt className="text-bone/45">{es ? "Límite mismo día" : "Same-day cutoff"}</dt>
            <dd className="mt-1 text-bone">{SITE.cutoffTime}</dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={SITE.phoneHref}
            className="inline-flex items-center gap-3 rounded-full bg-bone px-6 py-3 font-sans text-base font-medium text-ink transition-[transform,background-color] [transition-duration:var(--motion-fast)] hover:bg-bone/90 active:scale-[0.97] will-change-transform"
          >
            {es ? `Llamar ${SITE.phoneDisplay}` : `Call ${SITE.phoneDisplay}`}
          </a>
          <Link
            href={`/${locale}/shop`}
            className="inline-flex items-center gap-2 rounded-full border border-bone/30 px-6 py-3 font-sans text-base text-bone transition-[transform,border-color] [transition-duration:var(--motion-fast)] hover:border-bone/60 active:scale-[0.97]"
          >
            {es ? "Ver la tienda" : "Browse the shop"}
          </Link>
        </div>
      </div>
    </header>
  );
}
