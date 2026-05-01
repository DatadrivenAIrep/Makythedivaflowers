// components/nav/CartButton.tsx
"use client";
import { useEffect, useState } from "react";
import { Bag } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { cartCount } from "@/lib/cart-helpers";

export function CartButton({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("nav");
  const lines = useCartStore((s) => s.lines);
  const open = useUIStore((s) => s.openDrawer);
  const count = cartCount(lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const visibleCount = mounted ? count : 0;
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`${t("cart")} (${visibleCount})`}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-ink/80 hover:text-ink transition-colors"
    >
      <Bag size={18} weight="regular" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("cart")}</span>
      {visibleCount > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rouge text-bone text-[10px] font-mono">
          {visibleCount}
        </span>
      )}
    </button>
  );
}
