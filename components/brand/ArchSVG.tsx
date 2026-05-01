"use client";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Translates the storefront floral arch into a self-drawing SVG outline.
 * On mount, the arch line draws from base-left clockwise to base-right
 * over ~1.4s. Once drawn, children render inside the arch.
 */
export function ArchSVG({
  className,
  children,
  strokeWidth = 1.25,
  duration = 1.4,
}: {
  className?: string;
  children?: React.ReactNode;
  strokeWidth?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  // Arch: starts at (0,1), arcs through (0.5,0) to (1,1) — half-ellipse
  const d = "M 0 1 A 0.5 0.5 0 0 1 1 1";

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <motion.path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth / 100}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : duration, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <motion.div
        className="relative size-full overflow-hidden"
        style={{ borderTopLeftRadius: "9999px", borderTopRightRadius: "9999px" }}
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : duration * 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
