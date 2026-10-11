// components/story/MakingOfPlayer.tsx
"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster: string;
  playLabel: string;
  videoLabel: string;
  /** shown on the poster, e.g. "0:46" */
  duration: string;
};

// Click-to-play film: nothing downloads until the viewer asks for it, then it
// plays with sound and native controls. The poster button is the whole frame
// so it's an easy tap target on phones.
export function MakingOfPlayer({ src, poster, playLabel, videoLabel, duration }: Props) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!started) return;
    const v = videoRef.current;
    v?.focus();
    v?.play().catch(() => {});
  }, [started]);

  if (started) {
    return (
      <video
        ref={videoRef}
        controls
        playsInline
        preload="auto"
        poster={poster}
        aria-label={videoLabel}
        className="absolute inset-0 h-full w-full bg-ink object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStarted(true)}
      aria-label={`${playLabel} (${duration})`}
      className="group absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/35 via-ink/10 to-transparent" />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-3 whitespace-nowrap rounded-full bg-bone/90 py-2 pl-2 pr-5 text-ink backdrop-blur-sm transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-[0.98]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-bone">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 3 1.2Z" />
          </svg>
        </span>
        <span className="font-sans text-sm tracking-tight">{playLabel}</span>
        <span className="font-mono text-[11px] text-ink/60">{duration}</span>
      </span>
    </button>
  );
}
