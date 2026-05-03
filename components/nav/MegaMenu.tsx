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
            <div className="mx-auto grid max-w-[var(--container-max)] grid-cols-6 gap-4">
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
                    sizes="200px"
                  />
                  <div className="absolute inset-x-3 bottom-3">
                    <span className="font-display text-xl leading-none tracking-tight text-bone drop-shadow-[0_2px_4px_rgba(14,13,12,0.4)]">
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
