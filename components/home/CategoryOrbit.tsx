"use client";
import { memo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/cn";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";

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
        "group relative block rounded-[var(--radius-product)] border bg-mute-100 transition-colors duration-500",
        "h-44 md:h-auto",
        layout.col,
        layout.row,
        isActive ? "border-rouge/25" : "border-transparent"
      )}
      style={{ borderRadius: "var(--radius-product)" }}
    >
      {/* The whole arrangement, floating on the plaster; lifts on hover. Phone:
          photo on the right half so the name keeps the left. */}
      <FloatingPhoto
        src={item.img}
        alt={item.name}
        sizes="(min-width: 768px) 30vw, 50vw"
        className={cn(
          "top-3 bottom-3 left-1/2 right-3 md:inset-x-5 md:top-10 md:bottom-16",
          "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none",
          isActive && !reduce && "-translate-y-2"
        )}
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
              className="rounded-full border border-ink/10 bg-bone/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink backdrop-blur-sm"
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
              isActive ? "md:text-rouge" : "md:text-mute-400"
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
                "text-ink",
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
                  className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.18em] text-rouge"
                >
                  {shopLabel} {item.name} →
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile chevron */}
          <span aria-hidden className="md:hidden font-mono text-sm text-ink/50">→</span>

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
      className="relative min-h-[100dvh] overflow-hidden bg-bone py-16 text-ink md:py-32"
    >
      <div className="relative z-10 mx-auto max-w-[1600px] px-6">
        <div className="relative z-20 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
              {eyebrow}
            </span>
            <motion.h2
              animate={{ opacity: activeSlug ? 0.15 : 1 }}
              transition={{ duration: 0.5, ease: ELEGANT }}
              className="font-display tracking-tighter leading-[0.95] text-ink"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              {title}
            </motion.h2>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <span aria-hidden className="block h-px w-16 bg-ink/15" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-400">
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
                className="font-display italic tracking-tighter leading-[0.85] text-ink/[0.07]"
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
