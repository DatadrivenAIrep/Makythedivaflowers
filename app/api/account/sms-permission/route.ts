import { z } from "zod";
import { runMigrations } from "@/lib/db-migrate";
import { ipFromRequest } from "@/lib/rate-limit";
import { grantPromoConsent, revokePromoConsent, smsPermission } from "@/lib/promo-consent";
import { guardAccountDates, json } from "@/lib/account-dates-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ grant: z.boolean() });

export async function POST(req: Request) {
  const guard = guardAccountDates(req);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  runMigrations();
  const ctx = { source: "account" as const, ip: ipFromRequest(req) };

  if (parsed.data.grant) {
    const permission = grantPromoConsent(guard.customerId, ctx);
    return permission === "stopped" ? json({ permission }, 409) : json({ permission });
  }
  revokePromoConsent(guard.customerId, ctx);
  return json({ permission: smsPermission(guard.customerId) });
}
