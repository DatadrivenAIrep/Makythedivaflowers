// Public, unguessable-code statement page. Outside the locale tree and
// excluded from the proxy matcher, like /c/[code].
import { CODE_PATTERN } from "@/lib/short-code";
import { getStatementByCode } from "@/lib/house-account-statements";
import { getAccount } from "@/lib/house-account-storage";
import { buildStatementHtml, notFoundPage, voidPage } from "@/lib/house-statement-html";
import { shopDateStr } from "@/lib/tv-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const statement = CODE_PATTERN.test(code) ? getStatementByCode(code) : null;
  if (!statement) return html(notFoundPage(), 404);
  const account = getAccount(statement.accountId);
  if (!account) return html(notFoundPage(), 404);
  if (statement.status === "void") return html(voidPage(account.locale), 410);
  const justPaid = new URL(req.url).searchParams.get("paid") === "1";
  return html(await buildStatementHtml(statement, account, { today: shopDateStr(new Date()), justPaid }), 200);
}
