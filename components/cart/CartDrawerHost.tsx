// components/cart/CartDrawerHost.tsx
"use client";
import { CartDrawer } from "@/components/cart/CartDrawer";
import type { Locale } from "@/types/locale";

export function CartDrawerHost({ locale }: { locale: Locale }) {
  return <CartDrawer locale={locale} />;
}
