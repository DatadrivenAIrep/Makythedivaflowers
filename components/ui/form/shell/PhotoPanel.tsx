import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";

type Props = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  body?: string;
  signature?: string;
  priority?: boolean;
  /**
   * Catalog arrangement instead of a venue photo: show it whole, floating on
   * the plaster (its own photo background), with the copy in ink below it.
   * Default (false) keeps the full-bleed cropped photo under a dark gradient.
   */
  float?: boolean;
};

export function PhotoPanel({ src, alt, eyebrow, title, body, signature, priority, float }: Props) {
  const copy = (
    <div
      className={cn(
        "relative z-10 flex flex-col justify-end p-6 md:p-12",
        float ? "text-ink" : "h-full text-bone",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-3">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl md:text-4xl tracking-tighter leading-[0.95] mb-4">
        {title}
      </h2>
      {body && (
        <p
          className={cn(
            "font-sans text-sm leading-relaxed max-w-md hidden md:block",
            float ? "text-ink/75" : "text-bone/85",
          )}
        >
          {body}
        </p>
      )}
      {signature && (
        <p
          className={cn(
            "mt-6 font-mono text-[10px] uppercase tracking-[0.22em] hidden md:block",
            float ? "text-mute-500" : "text-bone/45",
          )}
        >
          {signature}
        </p>
      )}
    </div>
  );

  if (float) {
    return (
      <div data-testid="photo-panel" className="h-full bg-mute-100">
        {/* The form beside this panel is long; on desktop the arrangement and
            copy stay pinned in view (one screen tall) while the form scrolls.
            Needs FormShell's left column to be overflow-clip, not hidden. */}
        <div className="flex flex-col md:sticky md:top-[var(--nav-offset)] md:h-[calc(100dvh-var(--nav-offset))] md:min-h-[560px]">
          <div className="relative h-[240px] md:h-auto md:min-h-0 md:flex-1">
            <FloatingPhoto
              src={src}
              alt={alt}
              sizes="(max-width: 768px) 100vw, 42vw"
              priority={priority}
              className="inset-x-6 top-6 bottom-0 md:inset-x-12 md:top-10"
            />
          </div>
          {copy}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="photo-panel" className="relative h-full min-h-[280px] md:min-h-[640px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 42vw"
        priority={priority}
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/15"
      />
      {copy}
    </div>
  );
}
