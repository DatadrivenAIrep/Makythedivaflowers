import { NextResponse } from "next/server";
import {
  listCustomers,
  type CustomerListFilters,
  type CustomerSegmentFilter,
  type CustomerSort,
} from "@/lib/customer-storage";

export const runtime = "nodejs";

const SEGMENTS = new Set<string>(["new", "recurring", "vip", "at_risk"]);
const SORTS = new Set<string>(["last_order", "ltv", "orders", "name"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const segment = sp.get("segment");
  const sort = sp.get("sort");
  const filters: CustomerListFilters = {
    q: sp.get("q") ?? undefined,
    segment: segment && SEGMENTS.has(segment) ? (segment as CustomerSegmentFilter) : undefined,
    tag: sp.get("tag") ?? undefined,
    sort: sort && SORTS.has(sort) ? (sort as CustomerSort) : undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  };
  return NextResponse.json(listCustomers(filters));
}
