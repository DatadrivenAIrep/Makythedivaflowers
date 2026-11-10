import { z } from "zod";
import { runMigrations } from "@/lib/db-migrate";
import { dismissSuggestion } from "@/lib/customer-dates-storage";
import { accountDatesView, addCustomerDate } from "@/lib/account-dates";
import { guardAccountDates, json } from "@/lib/account-dates-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    kind: z.enum(["birthday", "anniversary"]),
    name: z.string().max(200),
    month: z.number().int(),
    day: z.number().int(),
  }),
  z.object({ action: z.literal("dismiss_suggestion"), key: z.string().min(1).max(200) }),
]);

export async function GET(req: Request) {
  const guard = guardAccountDates(req);
  if ("response" in guard) return guard.response;
  runMigrations();
  return json(accountDatesView(guard.customerId));
}

export async function POST(req: Request) {
  const guard = guardAccountDates(req);
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const body = parsed.data;
  runMigrations();

  if (body.action === "dismiss_suggestion") {
    dismissSuggestion(guard.customerId, body.key);
    return json({ ok: true });
  }
  const result = addCustomerDate(guard.customerId, body);
  if (!result.ok) return json({ error: result.error }, result.error === "too_many_dates" ? 409 : 400);
  return json({ ok: true, stamp: result.stamp });
}
