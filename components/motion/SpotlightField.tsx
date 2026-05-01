"use client";
import { memo, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * A 220px radial light that follows the cursor inside its container.
 * Hover-only effect — does NOT replace the cursor (taste-skill bans custom cursors).
 */
function SpotlightFieldImpl({
  className,
  color = "rgba(184, 52, 94, 0.18)",
}: {
  className?: string;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 180, damping: 22 });
  const sy = useSpring(y, { stiffness: 180, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };
  const onLeave = () => {
    x.set(-9999);
    y.set(-9999);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative overflow-hidden", className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute size-[440px] rounded-full"
        style={{
          x: sx,
          y: sy,
          translateX: "-50%",
          translateY: "-50%",
          background: `radial-gradient(circle at center, ${color}, transparent 60%)`,
        }}
      />
    </div>
  );
}

export const SpotlightField = memo(SpotlightFieldImpl);
