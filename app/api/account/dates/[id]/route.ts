import { z } from "zod";
import { runMigrations } from "@/lib/db-migrate";
import { listDatesFor, removeImportantDate } from "@/lib/customer-dates-storage";
import { setDatePreferences } from "@/lib/date-preferences-storage";
import { FLOWERS, COLORS, AVOID } from "@/lib/date-preference-options";
import { claimBonus, runBonus } from "@/lib/loyalty-bonus";
import { guardAccountDates, json } from "@/lib/account-dates-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const likesSchema = z.object({
  flowers: z.array(z.enum(FLOWERS)).max(20),
  colors: z.array(z.enum(COLORS)).max(20),
  avoid: z.array(z.enum(AVOID)).max(40),
});

const owns = (customerId: string, dateId: string) => listDatesFor(customerId).some((d) => d.id === dateId);

// Deleting is immediate and takes no confirmation: a date can become painful overnight.
export async function DELETE(req: Request, ctx: Ctx) {
  const guard = guardAccountDates(req);
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  runMigrations();
  if (!owns(guard.customerId, id)) return json({ error: "not_found" }, 404);
  removeImportantDate(guard.customerId, id);
  return json({ ok: true });
}

export async function PUT(req: Request, ctx: Ctx) {
  const guard = guardAccountDates(req);
  if ("response" in guard) return guard.response;
  const parsed = likesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const { id } = await ctx.params;
  runMigrations();
  if (!owns(guard.customerId, id)) return json({ error: "not_found" }, 404);

  const stored = setDatePreferences(id, parsed.data);
  // "Avoid" alone never earns a stamp.
  const stamp =
    (stored.flowers.length > 0 || stored.colors.length > 0) && claimBonus(guard.customerId, "gustos");
  if (stamp) void runBonus(guard.customerId, "gustos").catch(() => {});
  return json({ ok: true, prefs: stored, stamp });
}
