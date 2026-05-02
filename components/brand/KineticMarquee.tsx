"use client";
import { memo } from "react";
import { useReducedMotion } from "framer-motion";
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
  // duration: pixels-per-second → seconds for one full tile width (2 copies = 100%)
  // duration in seconds: lower speed = slower. At speed=40 → ~25s per full loop
  const duration = `${(1000 / speed).toFixed(1)}s`;

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-ink/10 bg-bone py-5",
        className,
      )}
      aria-hidden
    >
      <div
        className="flex whitespace-nowrap w-max"
        style={
          reduce
            ? undefined
            : {
                animation: `marquee-scroll ${duration} linear infinite`,
              }
        }
      >
        {/* Two identical copies — CSS animates from 0 to -50%, then loops seamlessly */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="font-display text-3xl md:text-5xl tracking-tight px-8 text-ink"
                style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 50" }}
              >
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export const KineticMarquee = memo(KineticMarqueeImpl);
