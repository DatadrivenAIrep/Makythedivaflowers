"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
  style?: React.CSSProperties;
};

function StaggerGroupImpl({
  children,
  delay = 0,
  stagger = 0.09,
  className,
  style,
}: Props) {
  const reduce = useReducedMotion();
  const variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: delay },
    },
  };
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0 }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

export const StaggerGroup = memo(StaggerGroupImpl);

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 } as const,
  },
};

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}
