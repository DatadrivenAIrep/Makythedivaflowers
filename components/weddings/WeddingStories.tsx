"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { weddingEvents } from "@/data/wedding-events";
import { WeddingStoryCard } from "./WeddingStoryCard";
import { WeddingLightbox } from "./WeddingLightbox";
import type { Locale } from "@/types/locale";

export function WeddingStories({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.stories");
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvent = weddingEvents.find((e) => e.id === activeEventId) ?? null;

  return (
    <section className="py-16 sm:py-20">
      <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">
          {t("title")}
        </h2>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 divide-y divide-ink/10">
        {weddingEvents.map((event, i) => (
          <WeddingStoryCard
            key={event.id}
            event={event}
            index={i}
            locale={locale}
            onOpen={() => setActiveEventId(event.id)}
          />
        ))}
      </div>

      <WeddingLightbox
        event={activeEvent}
        locale={locale}
        onClose={() => setActiveEventId(null)}
      />
    </section>
  );
}
