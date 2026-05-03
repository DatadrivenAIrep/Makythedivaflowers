"use client";
import { memo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/cn";
import { PetalRain } from "@/components/home/PetalRain";

type Item = {
  slug: string;
  img: string;
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

  const handleEnter = useCallback(
    (_e: React.MouseEvent<HTMLAnchorElement>) => { onEnter(item.slug); },
    [onEnter, item.slug]
  );

  return (
    <Link
      ref={ref}
      href={item.href}
      onMouseEnter={handleEnter}
      onMouseLeave={onLeave}
      className={cn(
        "group relative block overflow-hidden rounded-[var(--radius-product)] border transition-colors duration-500",
        "h-32 md:h-auto",
        layout.col,
        layout.row,
        "max-md:border-petal/40",
        isActive ? "md:border-petal/40" : "md:border-petal/15"
      )}
      style={{ borderRadius: "var(--radius-product)" }}
    >
      {/* Image — always visible, parallax on hover */}
      <motion.div
        className="absolute inset-0"
        animate={reduce ? undefined : { y: isActive ? "-4%" : "0%" }}
        transition={{ duration: 0.6, ease: ELEGANT }}
        style={{ scale: 1.08 }}
      >
        <img
          src={item.img}
          alt={item.name}
          className="size-full object-cover"
        />
      </motion.div>

      {/* Gradient overlay — deepens on hover */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: isActive ? 1 : 0.72 }}
        transition={{ duration: 0.5, ease: ELEGANT }}
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.04) 100%)",
        }}
      />

      {/* Shop chip — appears top-right on hover */}
      <div className="absolute inset-x-0 top-0 hidden md:flex justify-end p-4 z-10">
        <AnimatePresence>
          {isActive && (
            <motion.span
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: ELEGANT }}
              className="rounded-full border border-white/20 bg-black/30 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone backdrop-blur-sm"
            >
              {shopLabel} →
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Text — slides up on hover */}
      <motion.div
        className="relative z-10 flex h-full flex-col justify-between p-4 md:p-7"
        animate={reduce ? undefined : { y: isActive ? -6 : 0 }}
        transition={{ duration: 0.5, ease: ELEGANT }}
      >
        <div className="flex items-start justify-end">
          <span
            className={cn(
              "font-mono text-[10px] tracking-[0.25em]",
              "max-md:text-rouge",
              "md:transition-colors md:duration-500",
              isActive ? "md:text-rouge" : "md:text-petal/40"
            )}
          >
            {item.index}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span
              className={cn(
                "font-display italic tracking-tight",
                "text-2xl md:text-3xl",
                "text-bone",
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
                  className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.18em] text-petal"
                >
                  {shopLabel} {item.name} →
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile chevron */}
          <span aria-hidden className="md:hidden font-mono text-sm text-bone/70">→</span>

          {/* Desktop pulse dot */}
          <div className="hidden md:block">
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
      </motion.div>
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
    <section
      className="relative min-h-[100dvh] overflow-hidden py-16 text-bone md:py-32"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, var(--color-charcoal) 0%, #F2C5D1 100%)",
      }}
    >
      <PetalRain />
      <div className="relative z-10 mx-auto max-w-[1600px] px-6">
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

          <div className="hidden md:flex items-center gap-4">
            <span aria-hidden className="block h-px w-16 bg-petal/20" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-petal/30">
              {hoverHint}
            </span>
          </div>
        </div>

        <div
          className="relative mt-10 grid grid-cols-1 gap-2.5 md:mt-16 md:grid-cols-12 md:gap-3 md:[grid-auto-rows:clamp(80px,12vh,140px)]"
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
            <span className="inline-block rounded-full border border-bone/30 bg-charcoal/70 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/80 backdrop-blur">
              LAT 40.7000° N · LON 73.6700° W
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:flex flex-col items-center overflow-hidden"
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
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
                [ {activeIndex} / 06 ]
              </span>
              <span
                className="font-display italic tracking-tighter leading-[0.85] text-ink/15"
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
