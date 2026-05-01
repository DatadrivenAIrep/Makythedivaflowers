"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, memo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { locales, type Locale } from "@/types/locale";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,/·";

function scramble(target: string, frame: number, frames: number): string {
  if (frame >= frames) return target;
  const out: string[] = [];
  for (let i = 0; i < target.length; i++) {
    const settle = (i / target.length) * frames;
    if (frame >= settle) out.push(target[i]);
    else out.push(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
  }
  return out.join("");
}

function LocaleSwitcherImpl({ current }: { current: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [display, setDisplay] = useState(`EN · ES`);
  const reduceMotion = useReducedMotion();

  const switchTo = (next: Locale) => {
    if (next === current) return;
    const frames = 14;
    const target = next === "en" ? "EN · ES" : "ES · EN";
    let frame = 0;
    const interval = setInterval(() => {
      setDisplay(scramble(target, frame, frames));
      frame += 1;
      if (frame > frames) clearInterval(interval);
    }, 28);

    const segments = pathname.split("/");
    segments[1] = next;
    const url = segments.join("/") || `/${next}`;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    startTransition(() => router.replace(url));
  };

  const other = (locales as readonly string[]).find((l) => l !== current) as Locale;

  return (
    <button
      onClick={() => switchTo(other)}
      aria-label={`Switch language to ${other.toUpperCase()}`}
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.2em] px-2.5 py-1.5 rounded-full",
        "text-ink/70 hover:text-ink border border-ink/10 hover:border-ink/30 transition-colors",
      )}
    >
      <motion.span layout={reduceMotion ? false : true}>{display}</motion.span>
    </button>
  );
}

export const LocaleSwitcher = memo(LocaleSwitcherImpl);
