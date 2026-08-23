"use client";
import { memo, useMemo, type ElementType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SPRING } from "@/lib/motion";

type Props = {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
  style?: React.CSSProperties;
  /** semantic element to render (e.g. "ul"/"ol"); defaults to a div */
  as?: ElementType;
};

function StaggerGroupImpl({
  children,
  delay = 0,
  stagger = 0.09,
  className,
  style,
  as,
}: Props) {
  const reduce = useReducedMotion();
  // motion.create (not the deprecated motion() call) memoized on `as`, so the
  // component type is stable across re-renders (no remount / reveal re-fire).
  const MotionTag = useMemo(() => motion.create(as ?? "div"), [as]);
  const variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: delay },
    },
  };
  return (
    <MotionTag
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0 }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

export const StaggerGroup = memo(StaggerGroupImpl);

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING.default,
  },
};

export function StaggerItem({
  children,
  className,
  as,
}: {
  children: React.ReactNode;
  className?: string;
  /** semantic element to render (e.g. "li"); defaults to a div */
  as?: ElementType;
}) {
  const MotionTag = useMemo(() => motion.create(as ?? "div"), [as]);
  return (
    <MotionTag variants={staggerItemVariants} className={className}>
      {children}
    </MotionTag>
  );
}
