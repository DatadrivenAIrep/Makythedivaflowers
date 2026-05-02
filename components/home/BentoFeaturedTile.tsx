"use client";
import { memo, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type BentoFeaturedTileProps = {
  locale: "en" | "es";
  slug: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  priceUSD: number;
};

function BentoFeaturedTileImpl({
  locale,
  slug,
  title,
  imageSrc,
  imageAlt,
  priceUSD,
}: BentoFeaturedTileProps) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 150, damping: 20 });
  const sy = useSpring(ry, { stiffness: 150, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 6);
    rx.set(-py * 6);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX: sx,
        rotateY: sy,
        transformPerspective: 1000,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative bg-petal text-ink rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[640px] h-full",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <div className="absolute inset-0">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-petal via-petal/40 to-transparent" />
      </div>

      <span
        className="absolute top-10 left-6 font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {t("featured_issue")}
      </span>

      <div className="absolute top-8 right-8 size-20 rounded-full border border-ink/30 flex flex-col items-center justify-center font-mono text-ink/80 bg-petal/40 backdrop-blur-sm">
        <span className="text-[9px] uppercase tracking-[0.2em] opacity-60">USD</span>
        <span className="text-2xl font-medium leading-none mt-1">${priceUSD}</span>
      </div>

      <div className="absolute top-32 right-8 flex items-center gap-2">
        <motion.span
          aria-hidden
          className="block size-1.5 rounded-full bg-rouge"
          animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
          {t("featured_limited")}
        </span>
      </div>

      <div className="absolute bottom-8 left-8 right-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60 mb-3 block">
          {t("featured_eyebrow")}
        </span>
        <h3
          className="font-display text-[clamp(3rem,6vw,5.5rem)] italic tracking-tighter leading-[0.88] text-ink"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {title}
        </h3>
        <Link
          href={`/${locale}/product/${slug}`}
          className="inline-block mt-5 font-sans text-sm tracking-tight text-ink underline-offset-4 hover:underline"
        >
          {t("featured_cta")} →
        </Link>
      </div>
    </motion.div>
  );
}

export const BentoFeaturedTile = memo(BentoFeaturedTileImpl);
