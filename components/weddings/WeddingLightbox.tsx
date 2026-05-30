"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { WeddingEvent } from "@/data/wedding-events";
import type { Locale } from "@/types/locale";

type Props = {
  event: WeddingEvent | null;
  locale: Locale;
  onClose: () => void;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function WeddingLightbox({ event, locale, onClose }: Props) {
  const t = useTranslations("weddings.stories");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; });

  // Reset index when a different event opens
  useEffect(() => {
    if (event !== null) setIndex(0);
  }, [event?.id]);

  // Body-scroll lock + initial focus
  useEffect(() => {
    if (!event) return;
    triggerRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [event?.id]);

  const photos = event?.photos ?? [];
  const total = photos.length;

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % total);
      if (e.key === "ArrowLeft")  setIndex((i) => (i - 1 + total) % total);
      trapFocus(e);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event?.id, total, trapFocus]);

  const active = photos[index] ?? null;

  return (
    <AnimatePresence>
      {event && active && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${event.venue[locale]} — ${event.date[locale]}`}
          className="fixed inset-0 z-[60] flex flex-col bg-ink/90 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25 }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-petal">
                {event.venue[locale]}
              </p>
              <p className="font-mono text-[10px] text-bone/50 mt-0.5">
                {event.date[locale]}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main photo */}
          <div className="relative flex-1 min-h-0">
            <Image
              src={active.src}
              alt={active.alt[locale]}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              aria-label={t("prev")}
              className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <CaretLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % total)}
              aria-label={t("next")}
              className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20 transition-colors"
            >
              <CaretRight size={18} />
            </button>
            <p className="absolute bottom-4 right-4 font-mono text-[11px] text-bone/60 bg-ink/50 rounded-full px-3 py-1 backdrop-blur-sm">
              {index + 1} / {total}
            </p>
          </div>

          {/* Thumbnail strip */}
          <div
            className="shrink-0 flex gap-2 overflow-x-auto px-6 py-4"
            style={{ scrollbarWidth: "none" }}
          >
            {photos.map((photo, i) => (
              <button
                key={`${event.id}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${t("go_to")} ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={`relative shrink-0 overflow-hidden rounded-md transition-all duration-300 ${
                  i === index
                    ? "h-16 w-24 ring-2 ring-petal ring-offset-2 ring-offset-ink opacity-100"
                    : "h-12 w-16 opacity-50 hover:opacity-100"
                }`}
              >
                <Image src={photo.src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
