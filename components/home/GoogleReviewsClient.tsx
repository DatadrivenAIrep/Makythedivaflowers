"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { GoogleReviewsCard } from "./GoogleReviewsCard";
import type { Review } from "@/data/reviews";

type Props = {
  reviews: Review[];
  locale: "en" | "es";
  autoplayMs?: number;
};

export function GoogleReviewsClient({ reviews, locale, autoplayMs = 7_000 }: Props) {
  const t = useTranslations("home.reviews");
  const reduceMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [inView, setInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowingOriginal(false);
  }, [activeIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.1,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const shouldAutoplay = !isPaused && inView && !reduceMotion && autoplayMs > 0;

  useEffect(() => {
    if (!shouldAutoplay) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % reviews.length);
    }, autoplayMs);
    return () => clearInterval(id);
  }, [shouldAutoplay, autoplayMs, reviews.length]);

  const goNext = useCallback(
    () => setActiveIndex((prev) => (prev + 1) % reviews.length),
    [reviews.length],
  );
  const goPrev = useCallback(
    () => setActiveIndex((prev) => (prev - 1 + reviews.length) % reviews.length),
    [reviews.length],
  );
  const goTo = useCallback((i: number) => setActiveIndex(i), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === " ") { e.preventDefault(); setIsPaused((p) => !p); }
    },
    [goNext, goPrev],
  );

  const review = reviews[activeIndex];
  const localeText = review.text[locale];
  const originalText = review.text[review.originalLang];
  const displayText = showingOriginal ? originalText : localeText;
  const showTranslateChip = locale !== review.originalLang;

  return (
    <div
      ref={containerRef}
      data-reviews-client
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {review.author}{review.occasion ? ` · ${review.occasion}` : ""}
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          id="reviews-panel"
          key={review.id}
          role="group"
          aria-roledescription="review"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <GoogleReviewsCard
            author={review.author}
            initials={review.initials}
            displayText={displayText}
            date={review.date}
            locale={locale}
            occasion={review.occasion}
            showTranslateChip={showTranslateChip}
            showingOriginal={showingOriginal}
            translateLabel={t("translated")}
            originalLabel={t("original")}
            onToggleTranslate={() => setShowingOriginal((s) => !s)}
            onPrev={goPrev}
            onNext={goNext}
            prevLabel={t("aria.prev")}
            nextLabel={t("aria.next")}
          />
        </motion.article>
      </AnimatePresence>

      <div className="flex gap-1.5 mt-6" role="tablist">
        {reviews.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="reviews-panel"
            aria-label={t("aria.goto", { n: i + 1 })}
            onClick={() => goTo(i)}
            className="relative h-[2px] flex-1 bg-mute-100 rounded-full overflow-hidden"
          >
            {i < activeIndex && (
              <span className="absolute inset-0 bg-ink rounded-full" />
            )}
            {i === activeIndex && (
              <motion.span
                key={`${r.id}-fill`}
                className="absolute inset-y-0 left-0 bg-ink rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isPaused || reduceMotion ? 0 : 1 }}
                transition={
                  isPaused || reduceMotion
                    ? { duration: 0 }
                    : { duration: autoplayMs / 1000, ease: "linear" }
                }
                style={{ transformOrigin: "left" }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
