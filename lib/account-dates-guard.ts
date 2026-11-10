import "server-only";
import { NextResponse } from "next/server";
import { currentCustomerId } from "@/lib/customer-auth";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { rateLimit } from "@/lib/rate-limit";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/** Flag off → 404, no session → 401, too many calls → 429; otherwise the customer id. */
export function guardAccountDates(req: Request): { customerId: string } | { response: NextResponse } {
  if (!dateRewardsEnabled()) return { response: json({ error: "not_found" }, 404) };
  const customerId = currentCustomerId(req);
  if (!customerId) return { response: json({ error: "unauthorized" }, 401) };
  if (!rateLimit(`account-dates:${customerId}`, { max: 60, windowMs: 10 * 60_000 }).ok) {
    return { response: json({ error: "rate_limited" }, 429) };
  }
  return { customerId };
}
