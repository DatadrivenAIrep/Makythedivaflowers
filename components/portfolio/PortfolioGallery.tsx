// components/portfolio/PortfolioGallery.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { MediaLightbox } from "@/components/portfolio/MediaLightbox";
import type { PortfolioEvent } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

export function PortfolioGallery({
  events,
  namespace,
  locale,
}: {
  events: PortfolioEvent[];
  namespace: string;
  locale: Locale;
}) {
  const t = useTranslations(namespace);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = events.find((e) => e.id === activeId) ?? null;

  return (
    <section className="py-16 sm:py-20">
      <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 divide-y divide-ink/10">
        {events.map((event, i) => (
          <PortfolioCard
            key={event.id}
            event={event}
            index={i}
            locale={locale}
            namespace={namespace}
            onOpen={() => setActiveId(event.id)}
          />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        <a
          href="#inquire"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-sans text-sm tracking-tight text-bone transition-colors hover:bg-ink/90"
        >
          {t("cta")}
        </a>
      </div>

      <MediaLightbox event={active} locale={locale} namespace={namespace} onClose={() => setActiveId(null)} />
    </section>
  );
}
