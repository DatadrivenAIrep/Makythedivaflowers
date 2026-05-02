"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

const ASPECT_DIMENSIONS: Record<PortfolioPhoto["aspect"], [number, number]> = {
  "1/1":  [1200, 1200],
  "16/9": [2400, 1350],
  "3/4":  [1500, 2000],
  "4/5":  [1200, 1500],
};

const ASPECT_CLASS: Record<PortfolioPhoto["aspect"], string> = {
  "1/1":  "aspect-square",
  "16/9": "aspect-[16/9]",
  "3/4":  "aspect-[3/4]",
  "4/5":  "aspect-[4/5]",
};

type Props = {
  photo: PortfolioPhoto;
  locale: Locale;
  index: number;
  showIndex?: boolean;
  priority?: boolean;
  sizes?: string;
  onOpen: (index: number) => void;
};

export function GalleryTile({ photo, locale, index, showIndex = false, priority = false, sizes = "(max-width: 768px) 100vw, 33vw", onOpen }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-12, 12]);

  const [w, h] = ASPECT_DIMENSIONS[photo.aspect];
  const aspectCls = ASPECT_CLASS[photo.aspect];
  const label = String(index + 1).padStart(2, "0");

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={photo.alt[locale]}
      layoutId={reduce ? undefined : `gallery-${photo.id}`}
      className={`group relative block w-full overflow-hidden rounded-2xl bg-bone ${aspectCls}`}
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div className="absolute inset-0" style={reduce ? undefined : { y, willChange: "transform" }}>
        <Image
          src={photo.src}
          alt={photo.alt[locale]}
          width={w}
          height={h}
          sizes={sizes}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </motion.div>
      {showIndex && (
        <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-ink/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-bone backdrop-blur-sm transition-all duration-300 translate-y-2 opacity-60 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100">
          {label}
        </span>
      )}
    </motion.button>
  );
}
