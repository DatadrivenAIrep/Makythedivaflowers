"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TvSlide } from "@/lib/tv-showcase";

export const SLIDE_MS = 9000;
export const REFRESH_MS = 30 * 60 * 1000;

type Role = "prev" | "current" | "next";

const LOGO = (
  <Image
    src="/logo-header.webp"
    alt="Maky the Diva Flowers"
    width={320}
    height={96}
    priority
    className="h-[6vh] w-auto"
  />
);

/**
 * Only three layers are mounted: the one fading out, the one on screen and the
 * next one (invisible, so its photo is already loaded when its turn comes).
 * Keys are slide ids, so a layer keeps its DOM node as its role changes and the
 * opacity transition does the crossfade.
 */
function layersFor(slides: TvSlide[], index: number): { slide: TvSlide; role: Role }[] {
  const n = slides.length;
  if (n === 1) return [{ slide: slides[0], role: "current" }];
  const roles = new Map<number, Role>();
  roles.set((index - 1 + n) % n, "prev");
  roles.set((index + 1) % n, "next");
  roles.set(index, "current");
  return [...roles].map(([i, role]) => ({ slide: slides[i], role }));
}

export default function Showcase({
  slides,
  reload = () => window.location.reload(),
}: {
  slides: TvSlide[];
  reload?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const n = slides.length;

  // `reload` may be a new function every render; the refresh interval must not
  // restart each slide change, so it reads the latest one through a ref.
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; });

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => clearInterval(id);
  }, [n]);

  // New products and prices arrive with a reload. Only reload when the site
  // answers, so a Wi-Fi drop keeps the slideshow up instead of an error page.
  useEffect(() => {
    const id = setInterval(() => {
      fetch(window.location.href, { cache: "no-store" })
        .then((res) => { if (res.ok) reloadRef.current(); })
        .catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Keep the TV awake where the browser supports it (most TV browsers ignore this).
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<unknown> } };
    const ask = () => { nav.wakeLock?.request("screen").catch(() => {}); };
    ask();
    const onVisible = () => { if (document.visibilityState === "visible") ask(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <div className="fixed inset-0 cursor-none overflow-hidden bg-mute-100 text-ink">
      {n === 0 ? (
        <div className="flex h-full items-center justify-center [&_img]:h-[14vh]">{LOGO}</div>
      ) : (
        layersFor(slides, index).map(({ slide, role }) => (
          <section
            key={slide.id}
            data-testid="tv-slide"
            data-role={role}
            aria-hidden={role !== "current"}
            className={`absolute inset-0 grid grid-cols-[58fr_42fr] transition-opacity duration-[1200ms] ease-in-out ${
              role === "current" ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex h-full items-end justify-center overflow-hidden pt-[5vh]">
              <Image
                src={slide.src}
                alt=""
                width={slide.width}
                height={slide.height}
                sizes="58vw"
                loading="eager"
                priority={role === "current"}
                className={`h-[90vh] w-auto max-w-full origin-bottom object-contain ${
                  role === "next" ? "" : "animate-[tv-zoom_10.5s_linear_forwards]"
                }`}
              />
            </div>
            <div className="flex flex-col justify-center pl-[2vw] pr-[6vw]">
              <h2 className="font-display text-[5.6vw] leading-[1.02]">{slide.nameEn}</h2>
              <p className="mt-[1.5vh] font-display text-[2.8vw] italic text-mute-600">{slide.nameEs}</p>
              <p className="mt-[5vh] text-[2vw] tracking-wide">
                {slide.price.en} <span className="text-mute-400">·</span> {slide.price.es}
              </p>
            </div>
            <div className="absolute bottom-[4vh] right-[3vw] flex items-center gap-[1vw] rounded-2xl bg-white/70 p-[0.8vw]">
              {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI */}
              <img src={slide.qr} alt="" className="h-[12vh] w-[12vh]" />
              <p className="text-[1.1vw] leading-tight">Order<br />Pide aquí</p>
            </div>
          </section>
        ))
      )}
      {n > 0 && <div className="absolute right-[3vw] top-[4vh]">{LOGO}</div>}
    </div>
  );
}
