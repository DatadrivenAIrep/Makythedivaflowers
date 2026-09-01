// components/social/ElfsightReviews.tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * Mount point for an Elfsight widget.
 *
 * `appId` is the widget id issued by the Elfsight dashboard — layout, review
 * set and rating are all configured there, not here. Swapping a widget means
 * pasting a new id into the caller.
 */
const PLATFORM_SRC = "https://elfsightcdn.com/platform.js";

type Props = {
  appId: string;
  /** Reserved height, so the widget does not shove the page down when it paints. */
  minHeight?: string;
};

export function ElfsightReviews({ appId, minHeight = "420px" }: Props) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;

    const load = () => {
      if (document.querySelector(`script[src="${PLATFORM_SRC}"]`)) return;
      const script = document.createElement("script");
      script.src = PLATFORM_SRC;
      script.async = true;
      document.body.appendChild(script);
    };

    // Deliberately not next/script: its `lazyOnload` hangs the fetch off
    // requestIdleCallback, and this site's pages animate continuously, so idle
    // time is not something to bet a third-party widget on. Watching the
    // viewport is deterministic, and no Elfsight code is fetched at all until
    // the reader is actually approaching the section.
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={holder} style={{ minHeight }}>
      <div className={`elfsight-app-${appId}`} data-elfsight-app-lazy />
    </div>
  );
}
