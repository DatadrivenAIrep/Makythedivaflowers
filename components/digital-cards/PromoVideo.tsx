"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/types/locale";

/**
 * The digital card promo, cut twice: 16:9 for wide screens and 9:16 for phones,
 * each in English and Spanish (`public/digital-cards/`). The vertical cut is the
 * one made for a phone held upright, so it is what a phone gets.
 */
type Shape = "16x9" | "9x16";

const PHONE = "(max-width: 767px)";
const src = (kind: "loop" | "film", locale: Locale, shape: Shape) => `/digital-cards/${kind}-${locale}-${shape}.mp4`;
const poster = (locale: Locale, shape: Shape) => `/digital-cards/poster-${locale}-${shape}.jpg`;

/** The cut this screen should get; `null` until mounted, when the server's poster stands in. */
function useShape(fixed?: Shape): Shape | null {
  const [shape, setShape] = useState<Shape | null>(fixed ?? null);
  useEffect(() => {
    if (fixed || !window.matchMedia) return;
    const mql = window.matchMedia(PHONE);
    const pick = () => setShape(mql.matches ? "9x16" : "16x9");
    pick();
    mql.addEventListener("change", pick);
    return () => mql.removeEventListener("change", pick);
  }, [fixed]);
  return shape;
}

/** A still instead of motion for reduced motion or Save-Data, as the home hero does. */
function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const read = () => setStill(Boolean(c?.saveData) || Boolean(mql?.matches));
    read();
    mql?.addEventListener("change", read);
    return () => mql?.removeEventListener("change", read);
  }, []);
  return still;
}

/** Before hydration: the right poster for the screen, chosen by the browser. */
function Poster({ locale, shape, className }: { locale: Locale; shape?: Shape; className?: string }) {
  if (shape) return <img role="presentation" alt="" src={poster(locale, shape)} className={className} />;
  return (
    <picture>
      <source media={PHONE} srcSet={poster(locale, "9x16")} />
      <img role="presentation" alt="" src={poster(locale, "16x9")} className={className} />
    </picture>
  );
}

/** The 10 s promo, silent and looping, as a moving picture. */
export function PromoLoop({ locale, shape: fixed, className }: { locale: Locale; shape?: Shape; className?: string }) {
  const shape = useShape(fixed);
  const still = useStill();
  if (!shape || still) return <Poster locale={locale} shape={shape ?? fixed} className={className} />;
  return (
    <video
      key={shape}
      aria-hidden
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster(locale, shape)}
      className={className}
    >
      <source src={src("loop", locale, shape)} type="video/mp4" />
    </video>
  );
}

/** The 30 s film with its sound, played only when the visitor asks for it. */
export function PromoFilm({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const shape = useShape();
  if (!shape) return <Poster locale={locale} className={className} />;
  return (
    <video key={shape} controls playsInline preload="none" poster={poster(locale, shape)} aria-label={label} className={className}>
      <source src={src("film", locale, shape)} type="video/mp4" />
    </video>
  );
}
