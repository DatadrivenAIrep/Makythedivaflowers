import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStatement } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { enqueue } from "@/lib/house-account-sends";
import { resolveChannels, dispatchSend } from "@/lib/house-account-sender";
import { shopDateStr } from "@/lib/tv-slots";
import { sendBody } from "@/schemas/house-account";

export const runtime = "nodejs";

/** "Enviar ya": a manual queue row for today, dispatched in the request so the log stays complete. */
export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sid } = await ctx.params;
  const parsed = sendBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const statement = getStatement(sid);
  if (!statement) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const account = getAccount(statement.accountId);
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (statement.status === "void") return NextResponse.json({ error: "statement_void" }, { status: 409 });
  const ch = resolveChannels(account, parsed.data.channel);
  if (!ch.sms && !ch.email) return NextResponse.json({ error: "no_channel", reason: ch.reasons.join(", ") }, { status: 422 });
  const today = shopDateStr(new Date());
  const [row] = enqueue([{ accountId: account.id, statementId: sid, kind: "manual", channel: parsed.data.channel, scheduledFor: today }]);
  const send = await dispatchSend(row, today);
  if (send.status === "failed") return NextResponse.json({ error: "send_failed", send }, { status: 502 });
  return NextResponse.json({ send });
}
