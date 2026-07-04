import { NextResponse } from "next/server";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";
import { getMetrics } from "@/lib/metrics-storage";
import type { MetricsRange } from "@/lib/metrics";

export const runtime = "nodejs";

const RANGES = new Set<string>(["30d", "90d", "ytd", "all"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const rawRange = sp.get("range");
  const range: MetricsRange = (rawRange && RANGES.has(rawRange) ? rawRange : "90d") as MetricsRange;
  const locale = sp.get("locale") === "en" ? "en" : "es";
  const m = (locale === "en" ? enMessages : esMessages).admin_metrics;
  const labels = { customProducts: m.custom_products, unknownZone: m.unknown_zone };
  return NextResponse.json(getMetrics(range, new Date(), locale, labels));
}
