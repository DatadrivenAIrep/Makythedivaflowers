"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
};

function BloomImageImpl({ src, alt, className, sizes }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      whileHover={reduce ? undefined : { scale: 1.02, rotate: -0.5 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
    >
      <img src={src} alt={alt} sizes={sizes} className="size-full object-cover" />
    </motion.div>
  );
}

export const BloomImage = memo(BloomImageImpl);
