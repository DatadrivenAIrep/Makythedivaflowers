"use client";
import { memo, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  wrapperClassName?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

function MagneticButtonImpl({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  wrapperClassName,
  ariaLabel,
  type = "button",
  disabled,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.18);
    y.set((e.clientY - cy) * 0.18);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const styleByVariant: Record<NonNullable<Props["variant"]>, string> = {
    primary:
      "bg-rouge text-bone hover:bg-rouge-glow rounded-2xl rounded-t-[var(--radius-arch-top)] px-6 py-4 font-sans font-medium tracking-tight text-base shadow-tile-rest active:scale-[0.98]",
    ghost:
      "bg-transparent text-ink border border-ink/15 hover:border-ink/35 rounded-full px-5 py-3 font-sans tracking-tight text-sm",
  };

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-300 will-change-transform",
        styleByVariant[variant],
        className,
      )}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cn("inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2", wrapperClassName)}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} disabled={disabled} className={cn("inline-block disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2", wrapperClassName)}>
      {inner}
    </button>
  );
}

export const MagneticButton = memo(MagneticButtonImpl);
