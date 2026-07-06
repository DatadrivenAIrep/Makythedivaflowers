// components/portfolio/MediaFrame.tsx
"use client";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { MediaItem } from "@/types/portfolio";
import type { Locale } from "@/types/locale";

export function MediaFrame({
  item,
  locale,
  sizes,
  priority,
  className,
}: {
  item: MediaItem;
  locale: Locale;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (item.type === "photo") {
    return (
      <Image
        src={item.src}
        alt={item.alt[locale]}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <video
      src={item.src}
      poster={item.poster}
      muted
      loop
      playsInline
      autoPlay={!reduce}
      preload="metadata"
      aria-label={item.alt[locale]}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  );
}
