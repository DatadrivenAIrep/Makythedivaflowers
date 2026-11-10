import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { isValidMonthDay } from "@/lib/customer-dates";
import { withTransaction } from "@/lib/db-tx";
import { addImportantDate, listDatesFor } from "@/lib/customer-dates-storage";
import { preferencesForRecipient, setDatePreferences } from "@/lib/date-preferences-storage";
import { FLOWERS, COLORS, AVOID } from "@/lib/date-preference-options";
import { orderQualifiesForPrompt, promptQuestion, promptReward } from "@/lib/date-prompt";
import { smsPermission, grantPromoConsent } from "@/lib/promo-consent";
import { claimBonus, runBonus, type BonusSlot } from "@/lib/loyalty-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("date"),
    kind: z.enum(["birthday", "anniversary"]),
    month: z.number().int(),
    day: z.number().int(),
    smsOptIn: z.boolean(),
  }),
  z.object({
    action: z.literal("likes"),
    flowers: z.array(z.enum(FLOWERS)).max(20),
    colors: z.array(z.enum(COLORS)).max(20),
    avoid: z.array(z.enum(AVOID)).max(40),
    smsOptIn: z.boolean(),
  }),
  z.object({ action: z.literal("dismiss") }),
]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function limited(req: Request, ip: string) {
  return !rateLimit(`date-prompt:${ip}`, { max: 30, windowMs: 10 * 60_000 }).ok;
}

export async function GET(req: Request, ctx: Ctx) {
  if (limited(req, ipFromRequest(req))) return json({ error: "rate_limited" }, 429);
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order || !orderQualifiesForPrompt(order)) return json({ error: "not_found" }, 404);
  const question = promptQuestion(order);
  if (!question || !order.customerId) return json({ error: "not_found" }, 404);
  const reward = await promptReward(order, question.kind === "date" ? "fecha" : "gustos");
  return json({ question, reward, permission: smsPermission(order.customerId) });
}

export async function POST(req: Request, ctx: Ctx) {
  const ip = ipFromRequest(req);
  if (limited(req, ip)) return json({ error: "rate_limited" }, 429);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const body = parsed.data;
  // An impossible date is rejected before the answer is consumed, so the customer can retry.
  if (body.action === "date" && !isValidMonthDay(body.month, body.day)) return json({ error: "invalid" }, 400);

  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return json({ error: "not_found" }, 404);

  runMigrations();
  const db = getDb();
  // Already answered is a 409, not a 404: look before the qualification rule (which also excludes it).
  if (db.prepare("SELECT 1 FROM date_prompt_answers WHERE order_id = ?").get(order.id)) {
    return json({ error: "already_answered" }, 409);
  }
  if (!orderQualifiesForPrompt(order)) return json({ error: "not_found" }, 404);
  const question = promptQuestion(order);
  const customerId = order.customerId;
  if (!question || !customerId) return json({ error: "not_found" }, 404);
  if (
    (body.action === "date" && question.kind !== "date") ||
    (body.action === "likes" && question.kind !== "likes")
  ) {
    return json({ error: "stale_question" }, 409);
  }

  // One transaction: the answer row and every write of the save land together or not at all.
  // The primary key is the lock: of two simultaneous taps only one gets past the INSERT.
  let slot: BonusSlot | null = null;
  try {
    withTransaction(() => {
      db.prepare("INSERT INTO date_prompt_answers (order_id, answer, created_at) VALUES (?, ?, ?)").run(
        order.id,
        body.action,
        new Date().toISOString(),
      );
      if (body.action === "date" && question.kind === "date") {
        const inherited = preferencesForRecipient(customerId, {
          name: question.recipientName,
          phone: order.fulfillment.recipient.phone,
        });
        const before = new Set(listDatesFor(customerId).map((d) => d.id));
        const after = addImportantDate(customerId, {
          kind: body.kind,
          label: question.recipientName,
          month: body.month,
          day: body.day,
          recipientPhone: order.fulfillment.recipient.phone,
          source: "customer",
        });
        const created = after.find((d) => !before.has(d.id));
        if (inherited && created) setDatePreferences(created.id, inherited);
        slot = "fecha";
      } else if (body.action === "likes" && question.kind === "likes") {
        const stored = setDatePreferences(question.dateId, {
          flowers: body.flowers,
          colors: body.colors,
          avoid: body.avoid,
        });
        // "Avoid" alone never earns a stamp.
        if (stored.flowers.length > 0 || stored.colors.length > 0) slot = "gustos";
      }
    });
  } catch (e) {
    if (e instanceof Error && /UNIQUE|PRIMARY KEY/i.test(e.message)) return json({ error: "already_answered" }, 409);
    throw e;
  }

  if ((body.action === "date" || body.action === "likes") && body.smsOptIn) {
    grantPromoConsent(customerId, { source: "date_prompt", ip });
  }

  const stamp = slot ? claimBonus(customerId, slot) : false;
  if (stamp && slot) void runBonus(customerId, slot).catch(() => {});

  return json({ ok: true, permission: smsPermission(customerId), stamp });
}
