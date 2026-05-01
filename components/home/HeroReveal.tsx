"use client";
import { memo, Children } from "react";
import { motion, useReducedMotion } from "framer-motion";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const itemVariantsReduced = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

function HeroRevealImpl({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {Children.map(children, (child, i) => (
        <motion.div
          key={i}
          variants={reduce ? itemVariantsReduced : itemVariants}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export const HeroReveal = memo(HeroRevealImpl);
