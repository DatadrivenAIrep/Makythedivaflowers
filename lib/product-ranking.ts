// Sales score per catalog product, the input to the shop's "Recommended" order.
// Pure and DB-free; lib/product-sales.ts feeds it the orders.
import { countsAsRevenue, type SaleStatus } from "@/lib/metrics/orders";

export type RankedOrder = SaleStatus & { createdAt: string; linesJson: string };

/** An order's weight halves every this many days, so the ranking follows the season. */
export const SALES_HALF_LIFE_DAYS = 90;

/**
 * Each real order (not canceled, abandoned or refunded; unpaid house-account
 * and shop orders count) adds its weight once to every catalog product on it.
 * Quantity is ignored on purpose: one order of fifty boutonnieres is still one
 * customer choosing that piece.
 */
export function salesScores(orders: readonly RankedOrder[], now: Date = new Date()): Map<string, number> {
  const scores = new Map<string, number>();
  for (const o of orders) {
    if (!countsAsRevenue(o)) continue;
    let lines: unknown;
    try {
      lines = JSON.parse(o.linesJson);
    } catch {
      continue;
    }
    if (!Array.isArray(lines)) continue;
    const ageDays = Math.max(0, (now.getTime() - Date.parse(o.createdAt)) / 86_400_000);
    if (!Number.isFinite(ageDays)) continue;
    const weight = 0.5 ** (ageDays / SALES_HALF_LIFE_DAYS);
    const ids = new Set<string>();
    for (const raw of lines) {
      const line = raw as Record<string, unknown>;
      if (line.kind === "catalog" && typeof line.productId === "string" && (typeof line.qty !== "number" || line.qty > 0)) {
        ids.add(line.productId);
      }
    }
    for (const id of ids) scores.set(id, (scores.get(id) ?? 0) + weight);
  }
  return scores;
}
