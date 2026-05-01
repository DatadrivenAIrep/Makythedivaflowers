"use client";
import Link from "next/link";
import { Bag } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";

export function CartButton({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("nav");
  const count = useCartStore((s) => s.count());
  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={`${t("cart")} (${count})`}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-ink/80 hover:text-ink transition-colors"
    >
      <Bag size={18} weight="regular" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("cart")}</span>
      {count > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rouge text-bone text-[10px] font-mono">
          {count}
        </span>
      )}
    </Link>
  );
}
