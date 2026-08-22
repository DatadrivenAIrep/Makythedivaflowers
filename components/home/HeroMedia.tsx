// components/home/HeroMedia.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

// Hero background: video with a subtle compositor-only parallax; static poster
// when the user prefers reduced motion or has Save-Data on (perf + a11y).
export function HeroMedia({ src, poster }: { src: string; poster: string }) {
  const reduce = useReducedMotion();
  const [saveData, setSaveData] = useState(false);
  // framer-motion's useReducedMotion caches its matchMedia read process-wide
  // on first use, so it can miss a preference set after that (e.g. a change
  // fired after another component mounted first). Read matchMedia directly
  // too, and keep listening for "change" so a live OS toggle while the hero
  // is already mounted switches video <-> poster without a remount.
  const [reduceMQ, setReduceMQ] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) setSaveData(true);

    if (window.matchMedia) {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduceMQ(mql.matches);
      const onChange = () => setReduceMQ(mql.matches);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // small parallax: video drifts up ~8% as the hero scrolls away
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);

  const still = reduce || reduceMQ || saveData;

  return (
    // The wrapper itself isn't aria-hidden: role="presentation" already
    // removes the <img> from the accessibility tree (it's decorative,
    // alt=""), and the <video> gets its own aria-hidden below — putting
    // aria-hidden on a shared ancestor would hide both from assistive tech
    // AND from any accessible-tree-aware query (e.g. getByRole) alike.
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {still ? (
        <img
          role="presentation"
          alt=""
          src={poster}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <motion.video
          aria-hidden
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          style={{ y, willChange: "transform" }}
          className="absolute inset-0 h-[116%] w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </motion.video>
      )}
    </div>
  );
}
