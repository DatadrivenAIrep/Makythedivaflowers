"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";

type Action = { label: string; onClick: () => void };

type Props = {
  title: string;
  body: string;
  action?: Action;
};

export function FormSuccess({ title, body, action }: Props) {
  const reduce = useReducedMotion();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      className="flex flex-col items-start gap-4"
    >
      <motion.span
        initial={reduce ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 14 }}
        className="inline-flex items-center justify-center size-10 rounded-full bg-rouge text-bone"
      >
        <Check size={18} weight="bold" />
      </motion.span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-4xl text-ink leading-[0.95] tracking-tighter outline-none"
      >
        {title}
      </h2>
      <p className="text-ink/70 max-w-md leading-relaxed">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:text-rouge/80"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
