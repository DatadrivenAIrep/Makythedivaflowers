"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photo: PortfolioPhoto;
  index: number;
  locale: Locale;
  priority?: boolean;
  onOpen: (index: number) => void;
};

export function GalleryHero({ photo, index, locale, priority = false, onOpen }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-100, 100]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={photo.alt[locale]}
      layoutId={reduce ? undefined : `gallery-${photo.id}`}
      className="group relative block w-full overflow-hidden bg-ink"
      initial={reduce ? false : { opacity: 0, scale: 1.02 }}
      whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="relative w-full" style={{ height: "clamp(0px, 56.25vw, 90vh)" }}>
        <motion.div className="absolute inset-[-10%]" style={reduce ? undefined : { y, willChange: "transform" }}>
          <Image
            src={photo.src}
            alt={photo.alt[locale]}
            fill
            sizes="100vw"
            priority={priority}
            className="object-cover"
          />
        </motion.div>
      </div>
    </motion.button>
  );
}
