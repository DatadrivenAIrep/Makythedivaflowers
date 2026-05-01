"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

function BentoPressTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const items = [...SITE.press, ...SITE.press];

  return (
    <div className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-8 md:p-10 min-h-[260px] flex flex-col justify-between overflow-hidden shadow-[var(--shadow-tile-rest)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
        {t("press_eyebrow")}
      </p>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={reduce ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          {items.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="font-display text-2xl md:text-3xl tracking-tighter text-ink"
              style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}
            >
              {p}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export const BentoPressTile = memo(BentoPressTileImpl);
