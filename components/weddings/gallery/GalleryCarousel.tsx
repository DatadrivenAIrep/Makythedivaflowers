"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  locale: Locale;
  onOpen: (index: number) => void;
  autoplayMs?: number;
};

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 400;

export function GalleryCarousel({ photos, locale, onOpen, autoplayMs = 5000 }: Props) {
  const t = useTranslations("weddings.gallery");
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const total = photos.length;
  const wrap = useCallback((i: number) => ((i % total) + total) % total, [total]);

  const goTo = useCallback((next: number) => {
    setDirection(next > active ? 1 : -1);
    setActive(wrap(next));
  }, [active, wrap]);

  const next = useCallback(() => { setDirection(1); setActive((a) => wrap(a + 1)); }, [wrap]);
  const prev = useCallback(() => { setDirection(-1); setActive((a) => wrap(a - 1)); }, [wrap]);

  // Autoplay (paused on hover/focus, on reduced motion, on tab hidden)
  useEffect(() => {
    if (reduce || paused || autoplayMs <= 0) return;
    const id = window.setInterval(next, autoplayMs);
    return () => window.clearInterval(id);
  }, [reduce, paused, autoplayMs, next]);

  // Pause when tab not visible
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Keyboard nav when the carousel region has focus inside it
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) next();
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) prev();
  };

  const activePhoto = photos[active];
  const counter = `${String(active + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <section
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("carousel_label")}
      className="relative w-full select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
    >
      {/* Stage */}
      <div
        className="relative mx-auto w-full overflow-hidden"
        style={{ height: "clamp(420px, 70vh, 820px)" }}
        aria-live="polite"
      >
        {/* Side peeks: previous + next behind active, blurred and dimmed */}
        {!reduce && (
          <>
            <SidePeek photo={photos[wrap(active - 1)]} locale={locale} side="left" onClick={prev} />
            <SidePeek photo={photos[wrap(active + 1)]} locale={locale} side="right" onClick={next} />
          </>
        )}

        {/* Active card */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.button
            key={activePhoto.id}
            type="button"
            onClick={() => onOpen(active)}
            aria-label={`${activePhoto.alt[locale]} — ${t("open_lightbox")}`}
            className="absolute left-1/2 top-1/2 z-10 block overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rouge"
            style={{ width: "min(78vw, 1100px)", height: "100%", x: "-50%", y: "-50%" }}
            custom={direction}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: "calc(-50% + " + (direction * 60) + "px)", scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: "-50%", scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: "calc(-50% - " + (direction * 60) + "px)", scale: 0.96 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30, mass: 0.9 }}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            layoutId={reduce ? undefined : `gallery-${activePhoto.id}`}
          >
            <Image
              src={activePhoto.src}
              alt={activePhoto.alt[locale]}
              fill
              sizes="(max-width: 768px) 90vw, 78vw"
              priority
              draggable={false}
              className="object-cover pointer-events-none"
            />
            {/* Caption + counter overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent p-6 sm:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/90">
                {counter}
              </p>
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Arrows */}
        <button
          type="button"
          onClick={prev}
          aria-label={t("prev")}
          className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bone/85 text-ink shadow-md backdrop-blur transition hover:bg-bone sm:left-6"
        >
          <CaretLeft size={18} weight="bold" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={t("next")}
          className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bone/85 text-ink shadow-md backdrop-blur transition hover:bg-bone sm:right-6"
        >
          <CaretRight size={18} weight="bold" />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-2 px-4">
        {photos.map((photo, i) => {
          const isActive = i === active;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${t("go_to")} ${i + 1}`}
              aria-current={isActive ? "true" : undefined}
              className={`relative h-12 w-16 overflow-hidden rounded-md transition-all duration-300 sm:h-14 sm:w-20 ${
                isActive
                  ? "ring-2 ring-rouge ring-offset-2 ring-offset-bone opacity-100 scale-105"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SidePeek({
  photo,
  locale,
  side,
  onClick,
}: {
  photo: PortfolioPhoto;
  locale: Locale;
  side: "left" | "right";
  onClick: () => void;
}) {
  const sideClass = side === "left" ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3";
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className={`absolute top-1/2 hidden h-[78%] w-[28vw] max-w-[360px] -translate-y-1/2 overflow-hidden rounded-2xl opacity-40 blur-[2px] transition-opacity duration-500 hover:opacity-60 lg:block ${sideClass}`}
    >
      <Image
        src={photo.src}
        alt=""
        fill
        sizes="28vw"
        className="object-cover"
        draggable={false}
      />
    </button>
  );
}
