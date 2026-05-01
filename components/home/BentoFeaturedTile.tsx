"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArchSVG } from "@/components/brand/ArchSVG";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

function BentoFeaturedTileImpl({ locale }: { locale: "en" | "es" }) {
  const reduce = useReducedMotion();
  const t = useTranslations("home.bento");
  return (
    <motion.div
      animate={reduce ? undefined : { rotate: [-0.4, 0.4, -0.4] }}
      transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      className={cn(
        "relative bg-petal text-ink rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[520px] p-8 md:p-10 flex flex-col justify-end",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <div className="absolute inset-x-10 top-10 bottom-32 text-rouge">
        <ArchSVG className="size-full">
          <img
            alt=""
            src="https://picsum.photos/seed/featured-arrangement/700/900"
            className="size-full object-cover"
          />
        </ArchSVG>
      </div>
      <div className="relative space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {t("featured_eyebrow")}
        </p>
        <p className="font-display text-3xl tracking-tighter leading-tight">
          The Ingrid Bouquet
        </p>
        <p className="font-mono text-sm">$187</p>
        <Link
          href={`/${locale}/product/the-ingrid-bouquet`}
          className="font-sans text-sm underline underline-offset-4 hover:no-underline"
        >
          {t("featured_cta")} →
        </Link>
      </div>
    </motion.div>
  );
}

export const BentoFeaturedTile = memo(BentoFeaturedTileImpl);
