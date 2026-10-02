import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaidManual, settleBalance, recordDeposit } from "@/lib/order-mutations";
import { moveOrderToAccount, removeOrderFromAccount } from "@/lib/house-account-ledger";
import { getOrder } from "@/lib/order-storage";

export const runtime = "nodejs";

const body = z.union([
  z.object({ method: z.enum(["cash", "zelle", "card-terminal", "ach"]), note: z.string().max(500).optional() }),
  z.object({ settleBalance: z.literal(true) }),
  z.object({
    deposit: z.object({
      amountCents: z.number().int().positive(),
      method: z.enum(["cash", "zelle", "card-terminal", "ach"]),
      note: z.string().max(500).optional(),
    }),
  }),
  z.object({ moveToAccount: z.object({ accountId: z.string().min(1) }) }),
  z.object({ removeFromAccount: z.literal(true) }),
]);

const CONFLICTS = new Set(["account_inactive", "already_on_account", "not_pending", "nothing_due", "not_on_account", "already_billed", "already_reversed", "has_payments"]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const data = parsed.data;
    if ("moveToAccount" in data) {
      moveOrderToAccount(id, data.moveToAccount.accountId, "maky");
      return NextResponse.json({ order: await getOrder(id) });
    }
    if ("removeFromAccount" in data) {
      removeOrderFromAccount(id, "maky");
      return NextResponse.json({ order: await getOrder(id) });
    }
    const order = "settleBalance" in data
      ? await settleBalance(id, "maky")
      : "deposit" in data
        ? await recordDeposit(id, data.deposit, "maky")
        : await markPaidManual(id, data);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (msg === "account_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (CONFLICTS.has(msg)) return NextResponse.json({ error: msg }, { status: 409 });
    if (/exceeds balance/.test(msg)) return NextResponse.json({ error: "deposit_exceeds_balance" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
