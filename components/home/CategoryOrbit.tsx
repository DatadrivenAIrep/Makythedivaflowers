"use client";
import { memo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/cn";

type Item = {
  slug: string;
  seed: string;
  index: string;
  name: string;
  href: string;
};

type Props = {
  title: string;
  eyebrow: string;
  hoverHint: string;
  shopLabel: string;
  items: Item[];
};

const ELEGANT = [0.16, 1, 0.3, 1] as const;

const TILE_LAYOUT: { col: string; row: string }[] = [
  { col: "md:col-start-1 md:col-span-5", row: "md:row-start-1 md:row-span-3" },
  { col: "md:col-start-6 md:col-span-4", row: "md:row-start-1 md:row-span-2" },
  { col: "md:col-start-10 md:col-span-3", row: "md:row-start-1 md:row-span-3" },
  { col: "md:col-start-6 md:col-span-3", row: "md:row-start-3 md:row-span-3" },
  { col: "md:col-start-9 md:col-span-4", row: "md:row-start-4 md:row-span-3" },
  { col: "md:col-start-1 md:col-span-5", row: "md:row-start-4 md:row-span-3" },
];

type TileProps = {
  item: Item;
  layout: { col: string; row: string };
  shopLabel: string;
  isActive: boolean;
  onEnter: (slug: string) => void;
  onLeave: () => void;
  reduce: boolean;
};

function TileImpl({
  item,
  layout,
  shopLabel,
  isActive,
  onEnter,
  onLeave,
  reduce,
}: TileProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { stiffness: 200, damping: 22 });
  const sy = useSpring(y, { stiffness: 200, damping: 22 });
  const [leavePos, setLeavePos] = useState({ x: 50, y: 50 });

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      x.set(px);
      y.set(py);
    },
    [x, y]
  );

  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      handleMove(e);
      onEnter(item.slug);
    },
    [handleMove, onEnter, item.slug]
  );

  const handleLeave = useCallback(() => {
    setLeavePos({ x: x.get(), y: y.get() });
    onLeave();
  }, [x, y, onLeave]);

  const cx = reduce ? 50 : sx.get();
  const cy = reduce ? 50 : sy.get();

  return (
    <Link
      ref={ref}
      href={item.href}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        "group relative block overflow-hidden rounded-[var(--radius-product)] border bg-charcoal transition-colors duration-500",
        "aspect-[16/10] md:aspect-auto",
        layout.col,
        layout.row,
        isActive ? "border-petal/40" : "border-petal/15"
      )}
      style={{ borderRadius: "var(--radius-product)" }}
    >
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={
          reduce
            ? { opacity: isActive ? 1 : 0 }
            : {
                clipPath: isActive
                  ? `circle(140% at ${cx}% ${cy}%)`
                  : `circle(0% at ${leavePos.x}% ${leavePos.y}%)`,
              }
        }
        transition={{ duration: 0.6, ease: ELEGANT }}
        style={{ willChange: "clip-path, opacity" }}
      >
        <img
          src={`https://picsum.photos/seed/${item.seed}/1200/800`}
          alt={item.name}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      </motion.div>

      <div className="relative z-10 flex h-full flex-col justify-between p-5 md:p-7">
        <div className="flex items-start justify-end">
          <span
            className={cn(
              "font-mono text-[10px] tracking-[0.25em] transition-colors duration-500",
              isActive ? "text-rouge" : "text-petal/40"
            )}
          >
            {item.index}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <motion.div
            animate={{ scale: isActive && !reduce ? 1.04 : 1 }}
            transition={{ duration: 0.4, ease: ELEGANT }}
            className="flex flex-col gap-2"
            style={{ transformOrigin: "left bottom" }}
          >
            <span
              className={cn(
                "font-display text-2xl md:text-3xl italic tracking-tight transition-colors duration-500",
                isActive ? "text-bone" : "text-bone/70"
              )}
            >
              {item.name}
            </span>
            <AnimatePresence>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3, ease: ELEGANT }}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-petal"
                >
                  {shopLabel} {item.name} →
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {isActive && !reduce ? (
            <motion.span
              aria-hidden
              className="block size-1 rounded-full bg-rouge"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
            />
          ) : (
            <span aria-hidden className="block size-1 rounded-full bg-rouge/60" />
          )}
        </div>
      </div>
    </Link>
  );
}

const Tile = memo(TileImpl);

function CategoryOrbitImpl({
  title,
  eyebrow,
  hoverHint,
  shopLabel,
  items,
}: Props) {
  const reduce = useReducedMotion() ?? false;
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const activeItem = items.find((i) => i.slug === activeSlug) ?? null;
  const activeIndex = activeItem ? activeItem.index : "00";

  const handleEnter = useCallback((slug: string) => setActiveSlug(slug), []);
  const handleLeave = useCallback(() => setActiveSlug(null), []);

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-charcoal py-24 text-bone md:py-32">
      <div className="relative mx-auto max-w-[1600px] px-6">
        <div className="relative z-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-petal/40">
              {eyebrow}
            </span>
            <motion.h2
              animate={{ opacity: activeSlug ? 0.15 : 1 }}
              transition={{ duration: 0.5, ease: ELEGANT }}
              className="font-display tracking-tighter leading-[0.95] text-bone"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              {title}
            </motion.h2>
          </div>

          <div className="flex items-center gap-4">
            <span aria-hidden className="block h-px w-16 bg-petal/20" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-petal/30">
              {hoverHint}
            </span>
          </div>
        </div>

        <div
          className="relative mt-12 grid grid-cols-1 gap-3 md:mt-16 md:grid-cols-12 md:gap-3"
          style={{ gridAutoRows: "clamp(80px, 12vh, 140px)" }}
        >
          {items.map((item, i) => (
            <Tile
              key={item.slug}
              item={item}
              layout={TILE_LAYOUT[i] ?? TILE_LAYOUT[0]}
              shopLabel={shopLabel}
              isActive={activeSlug === item.slug}
              onEnter={handleEnter}
              onLeave={handleLeave}
              reduce={reduce}
            />
          ))}

          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden -translate-x-1/2 -translate-y-1/2 md:block"
          >
            <span className="inline-block rounded-full border border-petal/20 bg-charcoal/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-petal/60 backdrop-blur">
              LAT 40.7000° N · LON 73.6700° W
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {activeItem && (
            <motion.div
              key={activeItem.slug}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.5, ease: ELEGANT }}
              className="flex w-full flex-col items-center"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-petal/40">
                [ {activeIndex} / 06 ]
              </span>
              <span
                className="font-display italic tracking-tighter leading-[0.85] text-petal/[0.08] mix-blend-screen"
                style={{ fontSize: "clamp(8rem, 18vw, 22rem)" }}
              >
                {activeItem.name}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export const CategoryOrbit = memo(CategoryOrbitImpl);
