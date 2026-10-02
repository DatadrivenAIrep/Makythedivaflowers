import { CODE_PATTERN } from "@/lib/short-code";
import { getStatementByCode } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { dueCents } from "@/lib/house-account-settlement";
import { createStatementCheckout } from "@/lib/house-statement-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const statement = CODE_PATTERN.test(code) ? getStatementByCode(code) : null;
  if (!statement) return text("not found", 404);
  const account = getAccount(statement.accountId);
  if (!account) return text("not found", 404);
  if (statement.status === "void") return text("gone", 410);
  if (statement.status !== "open" || dueCents(statement) <= 0) return text("nothing due", 409);
  const { url } = await createStatementCheckout(statement, account);
  return new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });
}
