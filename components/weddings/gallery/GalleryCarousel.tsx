"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { CaretLeft, CaretRight, Play, Pause } from "@phosphor-icons/react/dist/ssr";
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

const ASPECT_RATIO: Record<PortfolioPhoto["aspect"], number> = {
  "16/9": 16 / 9,
  "4/3":  4 / 3,
  "1/1":  1,
  "4/5":  4 / 5,
  "3/4":  3 / 4,
};

export function GalleryCarousel({ photos, locale, onOpen, autoplayMs = 5000 }: Props) {
  const t = useTranslations("weddings.gallery");
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [tick, setTick] = useState(0); // forces progress bar restart on slide change
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const total = photos.length;
  const wrap = useCallback((i: number) => ((i % total) + total) % total, [total]);

  const goTo = useCallback((nextIndex: number) => {
    setDirection(nextIndex > active ? 1 : -1);
    setActive(wrap(nextIndex));
    setTick((n) => n + 1);
  }, [active, wrap]);

  const next = useCallback(() => {
    setDirection(1);
    setActive((a) => wrap(a + 1));
    setTick((n) => n + 1);
  }, [wrap]);

  const prev = useCallback(() => {
    setDirection(-1);
    setActive((a) => wrap(a - 1));
    setTick((n) => n + 1);
  }, [wrap]);

  const isPlaying = !reduce && !hoverPaused && !tabHidden && !userPaused && autoplayMs > 0;

  // Autoplay
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(next, autoplayMs);
    return () => window.clearInterval(id);
  }, [isPlaying, autoplayMs, next, tick]);

  // Pause when tab not visible
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Keyboard nav when carousel has focus inside it
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

  // Auto-center the active thumbnail in the strip
  useEffect(() => {
    const strip = stripRef.current;
    const thumb = thumbRefs.current[active];
    if (!strip || !thumb || typeof strip.scrollTo !== "function") return;
    const target = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
    strip.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) next();
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) prev();
  };

  const activePhoto = photos[active];
  const counter = `${String(active + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const stageAspect = ASPECT_RATIO[activePhoto.aspect];

  return (
    <section
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("carousel_label")}
      className="relative w-full select-none"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setHoverPaused(false);
      }}
    >
      {/* Stage — adaptive height tied to active photo aspect */}
      <motion.div
        className="relative mx-auto w-full overflow-hidden"
        style={{
          maxWidth: "min(78vw, 1100px)",
          maxHeight: "78vh",
        }}
        animate={{ aspectRatio: stageAspect }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 28 }}
        aria-live="polite"
      >
        {/* Side peeks: previous + next behind active, blurred and dimmed */}
        {!reduce && (
          <>
            <SidePeek photo={photos[wrap(active - 1)]} side="left" onClick={prev} ariaLabel={t("prev")} />
            <SidePeek photo={photos[wrap(active + 1)]} side="right" onClick={next} ariaLabel={t("next")} />
          </>
        )}

        {/* Active card */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.button
            key={activePhoto.id}
            type="button"
            onClick={() => onOpen(active)}
            aria-label={`${activePhoto.alt[locale]} — ${t("open_lightbox")}`}
            className="absolute inset-0 z-10 block h-full w-full overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rouge cursor-zoom-in"
            custom={direction}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 80, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -80, scale: 0.96 }}
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent p-6 sm:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/90">
                {counter}
              </p>
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Autoplay progress bar */}
        {!reduce && autoplayMs > 0 && (
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-[2px] bg-bone/15">
            <motion.div
              key={`${active}-${tick}-${isPlaying}`}
              className="h-full bg-bone"
              initial={{ width: "0%" }}
              animate={{ width: isPlaying ? "100%" : "0%" }}
              transition={{ duration: isPlaying ? autoplayMs / 1000 : 0, ease: "linear" }}
            />
          </div>
        )}

        {/* Play / Pause */}
        {!reduce && autoplayMs > 0 && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? t("play") : t("pause")}
            aria-pressed={userPaused}
            className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-bone/85 text-ink shadow-md backdrop-blur transition hover:bg-bone sm:right-6 sm:top-6"
          >
            {userPaused ? <Play size={14} weight="fill" /> : <Pause size={14} weight="fill" />}
          </button>
        )}

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
      </motion.div>

      {/* Thumbnail strip — single row, scroll-snap, auto-centered */}
      <div
        ref={stripRef}
        className="mx-auto mt-6 flex max-w-5xl items-center gap-2 overflow-x-auto px-[50%] pb-2 snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((photo, i) => {
          const isActive = i === active;
          return (
            <button
              key={photo.id}
              ref={(el) => { thumbRefs.current[i] = el; }}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${t("go_to")} ${i + 1}`}
              aria-current={isActive ? "true" : undefined}
              className={`relative shrink-0 snap-center overflow-hidden rounded-md transition-all duration-300 ${
                isActive
                  ? "h-16 w-24 ring-2 ring-rouge ring-offset-2 ring-offset-bone opacity-100"
                  : "h-12 w-16 opacity-50 hover:opacity-100"
              }`}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="96px"
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
  side,
  onClick,
  ariaLabel,
}: {
  photo: PortfolioPhoto;
  side: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
}) {
  const sideClass = side === "left" ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`group/peek absolute top-1/2 hidden h-[78%] w-[28vw] max-w-[360px] -translate-y-1/2 cursor-pointer overflow-hidden rounded-2xl opacity-30 blur-[2px] transition-all duration-500 hover:opacity-70 hover:blur-[1px] hover:scale-[1.03] lg:block ${sideClass}`}
    >
      <Image
        src={photo.src}
        alt=""
        fill
        sizes="28vw"
        className="object-cover transition-transform duration-700 group-hover/peek:scale-105"
        draggable={false}
      />
    </button>
  );
}
