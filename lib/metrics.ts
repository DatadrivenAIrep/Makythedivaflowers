// Order row shape shared by the metrics modules, plus the per-zone ranking. Pure
// and DB-free (no server-only import) so client components can import the types.
// Time bucketing lives in lib/metrics/period.ts, in the shop's time zone.

export type OrderMetricRow = {
  totalCents: number;
  amountPaidCents: number;
  paymentStatus: string; // "paid" | "pending" | "refunded"
  fulfillmentStatus: string; // includes "canceled"
  createdAt: string; // ISO UTC
  linesJson: string;
  addressZip: string | null;
};

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
