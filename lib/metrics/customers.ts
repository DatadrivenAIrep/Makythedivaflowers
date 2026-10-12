// Clientes tab: new vs returning buyers and the best buyers of the period. Pure.
import { isLive, revenueOf, type MetricOrder } from "@/lib/metrics/orders";

export function buyerKey(o: Pick<MetricOrder, "customerId" | "contactPhone">): string | null {
  if (o.customerId) return o.customerId;
  const digits = o.contactPhone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `phone:${digits}` : null;
}

/** Day of each buyer's first live order, across the whole history. */
export function firstOrderDays(orders: MetricOrder[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const o of orders) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const seen = first.get(key);
    if (!seen || o.day < seen) first.set(key, o.day);
  }
  return first;
}

export type BuyerSplit = { newBuyers: number; newCents: number; returningBuyers: number; returningCents: number };

/**
 * A buyer is new when their first order ever falls inside the period. With no
 * period start (all time) that would make everyone new, so there a buyer with a
 * single order counts as new and anyone with more as returning.
 */
export function newVsReturning(cur: MetricOrder[], firstDays: Map<string, string>, start: string | null): BuyerSplit {
  const byBuyer = new Map<string, { orders: number; cents: number }>();
  for (const o of cur) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const b = byBuyer.get(key) ?? { orders: 0, cents: 0 };
    b.orders += 1;
    b.cents += revenueOf(o);
    byBuyer.set(key, b);
  }
  const split: BuyerSplit = { newBuyers: 0, newCents: 0, returningBuyers: 0, returningCents: 0 };
  for (const [key, b] of byBuyer) {
    const isNew = start === null ? b.orders === 1 : (firstDays.get(key) ?? "") >= start;
    if (isNew) {
      split.newBuyers += 1;
      split.newCents += b.cents;
    } else {
      split.returningBuyers += 1;
      split.returningCents += b.cents;
    }
  }
  return split;
}

export type TopCustomer = { key: string; customerId: string | null; name: string; cents: number; orders: number };

export function topCustomers(cur: MetricOrder[], limit = 10): TopCustomer[] {
  const byBuyer = new Map<string, TopCustomer>();
  for (const o of cur) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const t = byBuyer.get(key) ?? { key, customerId: o.customerId, name: o.contactName?.trim() || o.contactPhone, cents: 0, orders: 0 };
    t.cents += revenueOf(o);
    t.orders += 1;
    byBuyer.set(key, t);
  }
  return [...byBuyer.values()]
    .filter((t) => t.cents > 0)
    .sort((a, b) => b.cents - a.cents || b.orders - a.orders || a.name.localeCompare(b.name))
    .slice(0, limit);
}
