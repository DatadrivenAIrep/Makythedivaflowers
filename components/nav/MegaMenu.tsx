"use client";
import { memo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";
import { CATS, LABELS } from "@/lib/shop-categories";

type Props = { locale: Locale; label: string };

function MegaMenuImpl({ locale, label }: Props) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <Link
        href={`/${locale}/shop`}
        className="font-sans text-sm tracking-tight text-ink/80 hover:text-ink transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-16 z-40 hidden border-y border-ink/10 bg-bone/95 px-6 py-8 backdrop-blur lg:block"
          >
            <div className="mx-auto grid max-w-[var(--container-max)] grid-cols-7 gap-3">
              {CATS.map((c) => (
                <Link
                  role="menuitem"
                  key={c.slug}
                  href={`/${locale}/shop/${c.slug}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-product)] bg-mute-100"
                >
                  <BloomImage
                    src={c.img}
                    alt={LABELS[c.slug][locale]}
                    className="h-full w-full"
                    sizes="160px"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent"
                  />
                  <div className="absolute inset-x-2 bottom-2">
                    <span className="font-display text-base font-medium leading-tight tracking-tight text-bone [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                      {LABELS[c.slug][locale]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const MegaMenu = memo(MegaMenuImpl);
