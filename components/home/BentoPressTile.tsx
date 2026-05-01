"use client";
import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

const QUOTES: Record<string, string> = {
  "The Cut":
    "The hot-pink storefront on Hempstead Turnpike has become a Long Island pilgrimage.",
  Vogue: "Diva's signature arch is the most photographed corner in Franklin Square.",
  Brides:
    "If you want flowers that look like they belong in a magazine, this is the studio.",
  "New York Magazine": "A florist with a real point of view — rare in 2025.",
  "Town & Country": "Maximalist arrangements with the discipline of a couture atelier.",
  Refinery29: "Romance, by the stem — and they mean it.",
};

function BentoPressTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const items = SITE.press;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(id);
  }, [reduce, paused, items.length]);

  const active = items[idx];
  const quote = QUOTES[active] ?? "";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative bg-bone border border-ink/10 rounded-[var(--radius-bento)] p-8 md:p-12 min-h-[200px] md:min-h-[280px] h-full overflow-hidden shadow-[var(--shadow-tile-rest)]"
    >
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center h-full">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute-500">
            {t("press_eyebrow")}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
            [ {String(idx + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} ]
          </span>
          <span aria-hidden className="block w-12 h-px bg-ink/15 mt-1" />
        </div>
        <div className="relative min-h-[120px] md:min-h-[160px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <p
                className="font-display text-3xl md:text-5xl tracking-tighter leading-[0.95]"
                style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 60" }}
              >
                {active}
              </p>
              <p className="font-sans text-sm text-mute-600 italic max-w-[55ch]">
                &ldquo;{quote}&rdquo;
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export const BentoPressTile = memo(BentoPressTileImpl);
