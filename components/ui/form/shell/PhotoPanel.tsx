import * as React from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  body?: string;
  signature?: string;
  priority?: boolean;
};

export function PhotoPanel({ src, alt, eyebrow, title, body, signature, priority }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px]">
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
      <div className="relative z-10 flex h-full flex-col justify-end p-6 md:p-12 text-bone">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-3">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl md:text-4xl tracking-tighter leading-[0.95] mb-4">
          {title}
        </h2>
        {body && (
          <p className="font-sans text-sm leading-relaxed text-bone/85 max-w-md hidden md:block">
            {body}
          </p>
        )}
        {signature && (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45 hidden md:block">
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}
