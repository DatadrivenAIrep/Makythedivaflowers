"use client";
import { memo, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

type NycParts = { hour: number; minute: number; second: number };

function getNycParts(): NycParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const hour = Number(get("hour"));
  return {
    hour: hour === 24 ? 0 : hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function timeToCutoff(now: NycParts): { h: number; m: number; s: number } {
  const cutoffTotal = 14 * 3600;
  const nowTotal = now.hour * 3600 + now.minute * 60 + now.second;
  let diff = cutoffTotal - nowTotal;
  if (diff <= 0) diff += 24 * 3600;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  return { h, m, s };
}

function AnimatedCounterImpl({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      count.set(to);
      return;
    }
    const controls = animate(count, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, to, reduce, count]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}
const AnimatedCounter = memo(AnimatedCounterImpl);

function BentoLiveStatusTileImpl() {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState<NycParts | null>(null);

  useEffect(() => {
    setNow(getNycParts());
    const id = setInterval(() => setNow(getNycParts()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(
      () => setIdx((i) => (i + 1) % SITE.recentDeliveries.length),
      4200,
    );
    return () => clearInterval(id);
  }, [reduce]);

  const current = SITE.recentDeliveries[idx];
  const hhmm = now ? `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}` : "--:--";
  const countdown = now ? timeToCutoff(now) : { h: 0, m: 0, s: 0 };
  const cutdownString = now ? `${countdown.h}h ${countdown.m}m ${countdown.s}s` : "—";

  return (
    <div className="relative bg-ink text-bone rounded-[var(--radius-bento)] p-7 md:p-8 min-h-[260px] h-full grid grid-rows-[auto_1fr_auto] gap-5 overflow-hidden shadow-[var(--shadow-tile-rest)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">
          <motion.span
            aria-hidden
            className="block size-1.5 rounded-full bg-rouge"
            animate={reduce ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          {t("live_status_label")} · {t("live_status_zone")}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {hhmm}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6 items-center">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/50">
            {t("live_status_stems_label")}
          </span>
          <span className="font-display text-5xl md:text-6xl tracking-tighter leading-none text-bone">
            <AnimatedCounter to={47} />
          </span>
        </div>
        <div className="flex flex-col gap-2 border-l border-bone/10 pl-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/50">
            {t("live_status_recent_label")}
          </span>
          <div className="relative h-12">
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
                <p className="font-mono text-[10px] text-bone/50 mt-0.5">{current.time}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-bone/10 pt-4 gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/50">
          SAME-DAY DELIVERY
        </span>
        <span className="font-mono text-[11px] tracking-[0.18em] text-bone">
          <span className="text-rouge font-medium">{cutdownString}</span>
          <span className="text-bone/50 ml-2">{t("live_status_cutoff")}</span>
        </span>
      </div>
    </div>
  );
}

export const BentoLiveStatusTile = memo(BentoLiveStatusTileImpl);
