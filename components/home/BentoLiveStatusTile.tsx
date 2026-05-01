"use client";
import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

function BentoLiveStatusTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % SITE.recentDeliveries.length), 4200);
    return () => clearInterval(id);
  }, [reduce]);

  const current = SITE.recentDeliveries[idx];

  return (
    <div className="relative bg-ink text-bone rounded-[var(--radius-bento)] p-8 md:p-10 min-h-[260px] flex flex-col justify-between overflow-hidden shadow-[var(--shadow-tile-rest)]">
      <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70">
        <motion.span
          aria-hidden
          className="block size-2 rounded-full bg-petal"
          animate={reduce ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {t("live_status_label")} · {t("live_status_zone")}
      </div>

      <div className="relative h-20">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={current.city}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="absolute inset-0 flex flex-col justify-center"
          >
            <p className="font-display text-2xl tracking-tighter">→ {current.city}</p>
            <p className="font-mono text-xs text-bone/60 mt-1">{current.time}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">
        {t("live_status_cutoff")}
      </p>
    </div>
  );
}

export const BentoLiveStatusTile = memo(BentoLiveStatusTileImpl);
