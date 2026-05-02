"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import { CartButton } from "@/components/nav/CartButton";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

export function TopNav({
  locale,
  navLinksSlot,
  mobileMenuSlot,
}: {
  locale: Locale;
  navLinksSlot: React.ReactNode;
  mobileMenuSlot?: React.ReactNode;
}) {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const reduceMotion = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (v) => {
    setCondensed(v > 80);
  });

  return (
    <motion.header
      initial={false}
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-all duration-300",
        condensed
          ? "bg-bone/90 backdrop-blur-md border-b border-ink/[0.06]"
          : "bg-bone border-b border-transparent",
      )}
      transition={reduceMotion ? { duration: 0 } : undefined}
    >
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-20">
        <Link href={`/${locale}`} aria-label="Maky the Diva Flowers — Home">
          <Image
            src="/logo-header.webp"
            alt="Maky the Diva Flowers"
            width={320}
            height={96}
            className="h-16 w-auto mix-blend-multiply"
            priority
          />
        </Link>
        {navLinksSlot}
        <div className="flex items-center gap-2">
          {mobileMenuSlot}
          <LocaleSwitcher current={locale} />
          <CartButton locale={locale} />
        </div>
      </div>
    </motion.header>
  );
}
