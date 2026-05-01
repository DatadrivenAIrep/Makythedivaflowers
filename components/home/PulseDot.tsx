"use client";
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

function PulseDotImpl() {
  const reduce = useReducedMotion();

  return (
    <motion.span
      aria-hidden
      className="absolute top-[45%] right-[28%] hidden lg:block size-2 rounded-full bg-rouge will-change-transform"
      animate={
        reduce
          ? {}
          : {
              scale: [1, 1.5, 1],
              opacity: [0.8, 1, 0.8],
            }
      }
      transition={
        reduce
          ? {}
          : {
              duration: 3,
              ease: "easeInOut",
              repeat: Infinity,
            }
      }
    />
  );
}

export const PulseDot = memo(PulseDotImpl);
