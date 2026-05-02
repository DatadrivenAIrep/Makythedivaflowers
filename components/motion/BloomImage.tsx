"use client";
import { memo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
};

function BloomImageImpl({ src, alt, className, imgClassName, sizes, priority }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      whileHover={reduce ? undefined : { scale: 1.02, rotate: -0.5 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
    >
      {/* → FIXED in 2.7: migrated from raw <img> to next/image <Image fill> for srcset, AVIF/WebP transcoding, and CLS prevention */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", imgClassName)}
      />
    </motion.div>
  );
}

export const BloomImage = memo(BloomImageImpl);
