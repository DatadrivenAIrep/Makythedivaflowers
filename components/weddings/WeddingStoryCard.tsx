"use client";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { WeddingEvent } from "@/data/wedding-events";
import type { Locale } from "@/types/locale";

type Props = {
  event: WeddingEvent;
  index: number;
  locale: Locale;
  onOpen: () => void;
};

export function WeddingStoryCard({ event, index, locale, onOpen }: Props) {
  const t = useTranslations("weddings.stories");
  const reduce = useReducedMotion();
  const reversed = index % 2 === 1;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5 }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${event.venue[locale]} — ${t("open_label")}`}
        className={`group w-full flex flex-col sm:grid min-h-[420px] cursor-pointer text-left ${
          reversed ? "sm:grid-cols-[2fr_3fr]" : "sm:grid-cols-[3fr_2fr]"
        }`}
      >
        {/* Photo panel */}
        <div className={`relative overflow-hidden min-h-[280px] sm:min-h-0 ${reversed ? "sm:order-2" : "sm:order-1"}`}>
          <Image
            src={event.heroSrc}
            alt={event.heroAlt[locale]}
            fill
            sizes="(max-width: 640px) 100vw, 60vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/10" />
          <p className="absolute bottom-5 right-5 font-mono text-[11px] uppercase tracking-[0.18em] text-bone/80 bg-ink/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            {t("photo_count", { count: event.photos.length })}
          </p>
        </div>

        {/* Info panel */}
        <div
          className={`bg-ink flex flex-col justify-end px-8 py-10 sm:px-10 ${
            reversed ? "sm:order-1" : "sm:order-2"
          }`}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/20 mb-auto">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petal mt-6 mb-3">
            {event.venue[locale]}
          </p>
          <h3 className="font-display text-3xl sm:text-4xl text-bone leading-tight tracking-tight mb-2">
            {event.venue[locale]}
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/50 mb-8">
            {event.date[locale]}
          </p>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bone/60 border-b border-bone/20 pb-1 w-fit transition-colors duration-200 group-hover:text-petal group-hover:border-petal/50">
            {t("open_label")} →
          </span>
        </div>
      </button>
    </motion.div>
  );
}
