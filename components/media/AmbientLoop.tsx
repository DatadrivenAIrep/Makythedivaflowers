// components/media/AmbientLoop.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Props = {
  src: string;
  poster: string;
  /** accessible labels for the pause/play toggle */
  pauseLabel: string;
  playLabel: string;
  className?: string;
};

// Silent decorative loop for in-page sections. Unlike the hero it is below
// the fold, so it only downloads/plays while on screen (preload="none" +
// IntersectionObserver), and it carries a pause toggle (WCAG 2.2.2: motion
// running longer than 5s must be pausable). Reduced motion / Save-Data get
// the static poster, same as HeroMedia.
export function AmbientLoop({ src, poster, pauseLabel, playLabel, className }: Props) {
  const reduce = useReducedMotion();
  const [reduceMQ, setReduceMQ] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [playing, setPlaying] = useState(false);
  // a viewer's explicit pause wins over scroll-driven auto-resume
  const userPaused = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const still = reduce || reduceMQ || saveData;

  useEffect(() => {
    const v = videoRef.current;
    if (still || !v) return;
    if (typeof IntersectionObserver === "undefined") {
      v.play().catch(() => {});
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPaused.current) v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [still]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {still ? (
        <img role="presentation" alt="" src={poster} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <video
            ref={videoRef}
            aria-hidden
            muted
            loop
            playsInline
            preload="none"
            poster={poster}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={src} type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? pauseLabel : playLabel}
            className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-ink/45 text-bone backdrop-blur-sm transition-colors hover:bg-ink/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone"
          >
            {playing ? (
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1" width="3" height="10" rx="0.5" />
                <rect x="7" y="1" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 3 1.2Z" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  );
}
