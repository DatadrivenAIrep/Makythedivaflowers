import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaidManual, settleBalance, recordDeposit } from "@/lib/order-mutations";

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
]);

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
    const order = "settleBalance" in data
      ? await settleBalance(id, "maky")
      : "deposit" in data
        ? await recordDeposit(id, data.deposit, "maky")
        : await markPaidManual(id, data);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/order not found/.test(msg)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (msg === "not_pending") return NextResponse.json({ error: "not_pending" }, { status: 409 });
    if (/exceeds balance/.test(msg)) return NextResponse.json({ error: "deposit_exceeds_balance" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
