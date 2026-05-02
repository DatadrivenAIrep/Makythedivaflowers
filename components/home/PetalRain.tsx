"use client";
import { memo, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Petal = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  rotateFrom: number;
  rotateTo: number;
  color: string;
  opacity: number;
};

const COLORS = [
  "var(--color-petal)",
  "var(--color-rouge-glow)",
  "var(--color-lilac)",
];

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (n: number) => rand(i * 7.13 + n);
    return {
      id: i,
      left: r(1) * 100,
      size: 10 + r(2) * 14,
      duration: 14 + r(3) * 12,
      delay: -r(4) * 20,
      drift: (r(5) - 0.5) * 80,
      rotateFrom: r(6) * 360,
      rotateTo: r(6) * 360 + (r(7) > 0.5 ? 360 : -360),
      color: COLORS[Math.floor(r(8) * COLORS.length)] ?? COLORS[0]!,
      opacity: 0.18 + r(9) * 0.22,
    };
  });
}

function PetalRainImpl({ count = 14 }: { count?: number }) {
  const reduce = useReducedMotion() ?? false;
  const petals = useMemo(() => buildPetals(count), [count]);

  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {petals.map((p) => (
        <motion.span
          key={p.id}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: -40,
            width: p.size,
            height: p.size * 1.4,
            opacity: p.opacity,
            willChange: "transform",
          }}
          initial={{ y: -40, x: 0, rotate: p.rotateFrom }}
          animate={{
            y: ["-5%", "110%"],
            x: [0, p.drift, -p.drift * 0.6, p.drift * 0.4, 0],
            rotate: [p.rotateFrom, p.rotateTo],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <svg
            viewBox="0 0 20 28"
            className="size-full"
            style={{ filter: "blur(0.3px)" }}
          >
            <path
              d="M10 1 C 16 6, 19 14, 14 24 C 12 26, 8 26, 6 24 C 1 14, 4 6, 10 1 Z"
              fill={p.color}
            />
          </svg>
        </motion.span>
      ))}
    </div>
  );
}

export const PetalRain = memo(PetalRainImpl);
