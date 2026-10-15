"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { PRODUCTS } from "@/data/products";
import { applyPriceOverrides, type PriceOverride } from "@/lib/price-overrides";
import type { Product } from "@/types/product";

const OverridesContext = createContext<readonly PriceOverride[]>([]);

/**
 * Hands the admin price overrides (read once by the locale layout) to client
 * components, so the bag and checkout show the price Stripe will charge.
 */
export function PricedCatalogProvider({
  overrides,
  children,
}: {
  overrides: readonly PriceOverride[];
  children: ReactNode;
}) {
  return <OverridesContext.Provider value={overrides}>{children}</OverridesContext.Provider>;
}

/** The catalog at today's prices. Without a provider, the base prices. */
export function usePricedProducts(): Product[] {
  const overrides = useContext(OverridesContext);
  return useMemo(() => applyPriceOverrides(PRODUCTS, overrides), [overrides]);
}
