// Pure, DB-free metrics aggregation. Operates on rows already fetched by
// metrics-storage; takes `now` where needed. No server-only import — the
// client components import the types here directly. All time math is UTC.

export type MetricsRange = "30d" | "90d" | "ytd" | "all";

export type OrderMetricRow = {
  totalCents: number;
  amountPaidCents: number;
  paymentStatus: string; // "paid" | "pending" | "refunded"
  fulfillmentStatus: string; // includes "canceled"
  createdAt: string; // ISO UTC
  linesJson: string;
  addressZip: string | null;
};

export function revenueCollectedCents(rows: OrderMetricRow[]): number {
  return rows.reduce((s, r) => s + r.amountPaidCents, 0);
}

export function paidOrderCount(rows: OrderMetricRow[]): number {
  return rows.filter((r) => r.amountPaidCents > 0).length;
}

export function aovCents(rows: OrderMetricRow[]): number {
  const paid = paidOrderCount(rows);
  return paid > 0 ? Math.round(revenueCollectedCents(rows) / paid) : 0;
}

export function outstandingCents(rows: OrderMetricRow[]): number {
  return rows.reduce((s, r) => {
    if (r.fulfillmentStatus === "canceled" || r.paymentStatus === "refunded") return s;
    return s + Math.max(0, r.totalCents - r.amountPaidCents);
  }, 0);
}

export type MonthlyBucket = { month: string; cents: number };

export function monthlyRevenue(rows: OrderMetricRow[], now: Date): MonthlyBucket[] {
  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
    buckets.set(key, 0);
  }
  for (const r of rows) {
    const key = r.createdAt.slice(0, 7); // "YYYY-MM" from ISO UTC
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.amountPaidCents);
  }
  return keys.map((month) => ({ month, cents: buckets.get(month) ?? 0 }));
}

export type ProductRank = { key: string; name: string; qty: number; cents: number | null };

export function topProducts(
  rows: OrderMetricRow[],
  resolveName: (productId: string) => string,
  customLabel: string,
  limit = 10,
): ProductRank[] {
  const agg = new Map<string, { name: string; qty: number; cents: number | null }>();
  for (const r of rows) {
    if (r.amountPaidCents <= 0) continue; // realized sales only
    let lines: unknown;
    try {
      lines = JSON.parse(r.linesJson);
    } catch {
      continue;
    }
    if (!Array.isArray(lines)) continue;
    for (const raw of lines) {
      const l = raw as Record<string, unknown>;
      const qty = typeof l.qty === "number" ? l.qty : 0;
      if (qty <= 0) continue;
      if (l.kind === "catalog" && typeof l.productId === "string") {
        const key = l.productId;
        const cur = agg.get(key) ?? { name: resolveName(key), qty: 0, cents: null };
        cur.qty += qty;
        agg.set(key, cur);
      } else if (l.kind === "custom") {
        const key = "__custom__";
        const price = typeof l.priceCents === "number" ? l.priceCents : 0;
        const cur = agg.get(key) ?? { name: customLabel, qty: 0, cents: 0 };
        cur.qty += qty;
        cur.cents = (cur.cents ?? 0) + price * qty;
        agg.set(key, cur);
      }
    }
  }
  // qty desc; on ties, catalog products rank ahead of the collapsed custom
  // bucket, then alphabetical by name.
  const customRank = (key: string) => (key === "__custom__" ? 1 : 0);
  return [...agg.entries()]
    .map(([key, v]) => ({ key, name: v.name, qty: v.qty, cents: v.cents }))
    .sort(
      (a, b) =>
        b.qty - a.qty ||
        customRank(a.key) - customRank(b.key) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export type ZoneRank = { zoneId: string; label: string; orderCount: number; cents: number };

export function byZone(
  rows: OrderMetricRow[],
  resolveZone: (zip: string) => { id: string; label: string } | null,
  unknownLabel: string,
): ZoneRank[] {
  const agg = new Map<string, { label: string; orderCount: number; cents: number }>();
  for (const r of rows) {
    if (!r.addressZip) continue; // pickup / in-store excluded
    const zone = resolveZone(r.addressZip);
    const id = zone?.id ?? "unknown";
    const label = zone?.label ?? unknownLabel;
    const cur = agg.get(id) ?? { label, orderCount: 0, cents: 0 };
    cur.orderCount += 1;
    cur.cents += r.amountPaidCents;
    agg.set(id, cur);
  }
  return [...agg.entries()]
    .map(([zoneId, v]) => ({ zoneId, label: v.label, orderCount: v.orderCount, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}
