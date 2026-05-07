"use client";
import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";

/**
 * Clears the local cart store once on mount. Used on the paid confirmation page
 * to handle the 3DS redirect case where CheckoutShell unmounted before clearing.
 */
export function ClearCartOnMount() {
  const clearCart = useCartStore((s) => s.clear);
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}
