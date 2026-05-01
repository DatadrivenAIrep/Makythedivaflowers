"use client";
import { memo, useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useTransform,
  useVelocity,
  useSpring,
  wrap,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/cn";

function KineticMarqueeImpl({
  text,
  speed = 28,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false });
  const directionFactor = useRef(1);

  const [repeat, setRepeat] = useState(6);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const widthOne = ref.current.firstElementChild?.getBoundingClientRect().width ?? 0;
    if (widthOne === 0) return;
    const needed = Math.ceil((window.innerWidth * 2) / widthOne) + 2;
    setRepeat(needed);
  }, [text]);

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    let moveBy = directionFactor.current * (speed / 1000) * delta;
    if (scrollVelocity.get() < 0) directionFactor.current = -1;
    else if (scrollVelocity.get() > 0) directionFactor.current = 1;
    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden border-y border-ink/10 bg-bone py-5",
        className,
      )}
      aria-hidden
    >
      <motion.div className="flex whitespace-nowrap" style={{ x }}>
        {Array.from({ length: repeat }).map((_, i) => (
          <span
            key={i}
            className="font-display text-3xl md:text-5xl tracking-tight px-8 text-ink"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 50" }}
          >
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export const KineticMarquee = memo(KineticMarqueeImpl);
