// components/motion/Reveal.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import { SPRING } from "@/lib/motion";

type Props = {
  children: ReactNode;
  /** seconds before this element begins revealing */
  delay?: number;
  /** initial downward offset in px (ignored under reduced motion) */
  y?: number;
  className?: string;
  as?: ElementType;
};

/**
 * Single-element scroll reveal on the shared spring. Fade + small rise once,
 * critically damped (no overshoot — Apple: entrances don't bounce). Reduced
 * motion collapses to a plain cross-fade with no translation.
 */
export function Reveal({ children, delay = 0, y = 16, className, as }: Props) {
  const reduce = useReducedMotion();
  const MotionTag = motion(as ?? "div");
  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={reduce ? { duration: 0.2 } : { ...SPRING.default, delay }}
    >
      {children}
    </MotionTag>
  );
}
