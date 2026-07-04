import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { customerStats } from "@/lib/customer-storage";
import { findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { PRODUCTS } from "@/data/products";
import {
  aovCents,
  byZone,
  monthlyRevenue,
  outstandingCents,
  paidOrderCount,
  revenueCollectedCents,
  topProducts,
  type MetricsRange,
  type MonthlyBucket,
  type OrderMetricRow,
  type ProductRank,
  type ZoneRank,
} from "@/lib/metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

export function rangeLowerBound(range: MetricsRange, now: Date): string | null {
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * DAY_MS).toISOString();
    case "ytd":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    case "all":
      return null;
  }
}

type OrderRowRaw = {
  id: string;
  total_cents: number;
  amount_paid_cents: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  lines_json: string;
  address_json: string | null;
};

function parseZip(addressJson: string | null): string | null {
  if (!addressJson) return null;
  try {
    const a = JSON.parse(addressJson) as { zip?: string };
    return typeof a.zip === "string" ? a.zip : null;
  } catch {
    return null;
  }
}

/** Row type carries `id` for test sanity but pure functions ignore it. */
export function fetchOrderRows(range: MetricsRange, now: Date): (OrderMetricRow & { id: string })[] {
  runMigrations();
  const lb = rangeLowerBound(range, now);
  const where = lb ? "WHERE created_at >= ?" : "";
  const params = lb ? [lb] : [];
  const rows = getDb()
    .prepare(
      `SELECT id, total_cents, amount_paid_cents, payment_status, fulfillment_status,
              created_at, lines_json, address_json
       FROM orders ${where}`,
    )
    .all(...params) as OrderRowRaw[];
  return rows.map((r) => ({
    id: r.id,
    totalCents: r.total_cents,
    amountPaidCents: r.amount_paid_cents,
    paymentStatus: r.payment_status,
    fulfillmentStatus: r.fulfillment_status,
    createdAt: r.created_at,
    linesJson: r.lines_json,
    addressZip: parseZip(r.address_json),
  }));
}

export type MetricsKpis = {
  revenueCents: number;
  outstandingCents: number;
  orderCount: number;
  paidOrderCount: number;
  aovCents: number;
  repeatRatePct: number;
};

export type MetricsPayload = {
  range: MetricsRange;
  kpis: MetricsKpis;
  monthly: MonthlyBucket[];
  topProducts: ProductRank[];
  byZone: ZoneRank[];
};

export type MetricsLabels = { customProducts: string; unknownZone: string };

export function getMetrics(
  range: MetricsRange,
  now: Date,
  locale: "en" | "es",
  labels: MetricsLabels,
): MetricsPayload {
  const rows = fetchOrderRows(range, now);
  const nameById = new Map(PRODUCTS.map((p) => [p.id, p.title[locale]]));
  const resolveName = (id: string) => nameById.get(id) ?? id;
  const resolveZone = (zip: string) => {
    const z = findDeliveryZoneByZip(zip);
    return z ? { id: z.id, label: z.label[locale] } : null;
  };
  return {
    range,
    kpis: {
      revenueCents: revenueCollectedCents(rows),
      outstandingCents: outstandingCents(rows),
      orderCount: rows.length,
      paidOrderCount: paidOrderCount(rows),
      aovCents: aovCents(rows),
      repeatRatePct: customerStats(now).repeatRatePct,
    },
    monthly: monthlyRevenue(rows, now),
    topProducts: topProducts(rows, resolveName, labels.customProducts),
    byZone: byZone(rows, resolveZone, labels.unknownZone),
  };
}
