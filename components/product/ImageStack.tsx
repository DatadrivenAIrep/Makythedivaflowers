// components/product/ImageStack.tsx
"use client";
import { useState, useRef, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useDragSpring } from "@/components/motion/useDragSpring";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
};

// Track height is fixed to the first image's aspect ratio; a product with
// mixed per-image aspect ratios would need a different layout (a no-op today
// — all multi-image products use a uniform aspect across their image set).
function aspectClass(a?: string) {
  return a === "1/1" ? "aspect-square" : a === "16/9" ? "aspect-video" : "aspect-[4/5]";
}

function ImageStackImpl({ product, locale }: Props) {
  const images = product.images;
  const [activeIdx, setActiveIdx] = useState(0);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const first = images[0];

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const snapPoints = images.map((_, i) => -i * width);
  const { value, bind, animateTo } = useDragSpring({
    axis: "x",
    snapPoints: snapPoints.length ? snapPoints : [0],
    onSettle: (p) => { if (width) setActiveIdx(Math.round(-p / width)); },
  });

  // Re-sync the track to the active image when the viewport width changes
  // (e.g. device rotation) so the crop doesn't land mid-image.
  useEffect(() => {
    if (width) value.set(-activeIdx * width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function goTo(i: number) {
    setActiveIdx(i);
    if (width) animateTo(-i * width);
  }

  if (!first) return null;
  const single = images.length < 2;

  return (
    <div>
      <div
        ref={viewportRef}
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100 touch-pan-y",
          aspectClass(first.aspect),
        )}
        role={single ? undefined : "group"}
        aria-roledescription={single ? undefined : "carousel"}
        aria-label={single ? undefined : product.title[locale]}
        tabIndex={single ? undefined : 0}
        onKeyDown={
          single
            ? undefined
            : (e) => {
                if (e.key === "ArrowRight" && activeIdx < images.length - 1) goTo(activeIdx + 1);
                if (e.key === "ArrowLeft" && activeIdx > 0) goTo(activeIdx - 1);
              }
        }
      >
        {single ? (
          <img src={first.src} alt={first.alt[locale]} className="absolute inset-0 size-full object-cover" />
        ) : (
          <motion.div className="flex h-full" style={{ x: value, willChange: "transform" }} {...bind}>
            {images.map((img) => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt[locale]}
                draggable={false}
                className="h-full w-full shrink-0 object-cover select-none"
              />
            ))}
          </motion.div>
        )}
      </div>

      {!single && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={img.alt[locale]}
              aria-current={i === activeIdx}
              className={cn(
                "aspect-square overflow-hidden rounded-[var(--radius-product)] border transition-colors",
                i === activeIdx ? "border-ink/45" : "border-ink/10 hover:border-ink/25",
              )}
            >
              <img src={img.src} alt={img.alt[locale]} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImageStack = memo(ImageStackImpl);
