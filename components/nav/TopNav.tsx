"use client";
import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Wordmark } from "@/components/brand/Wordmark";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import { CartButton } from "@/components/nav/CartButton";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

export function TopNav({
  locale,
  navLinksSlot,
}: {
  locale: Locale;
  navLinksSlot: React.ReactNode;
}) {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    setCondensed(v > 80);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-all duration-300",
        condensed
          ? "bg-bone/85 backdrop-blur-md border-b border-ink/[0.06]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-16">
        <Wordmark locale={locale} />
        {navLinksSlot}
        <div className="flex items-center gap-2">
          <LocaleSwitcher current={locale} />
          <CartButton locale={locale} />
        </div>
      </div>
    </motion.header>
  );
}
