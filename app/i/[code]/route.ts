// Public, unguessable-code invoice page — the link the customer gets by SMS or
// email. Outside the locale tree and excluded from the proxy matcher, like
// /s/[code] and /c/[code].
import { CODE_PATTERN } from "@/lib/short-code";
import { getOrderIdByInvoiceCode } from "@/lib/invoice-links";
import { getOrder } from "@/lib/order-storage";
import { buildInvoiceHtml, invoiceNotFoundPage } from "@/lib/invoice-html";

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

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const orderId = CODE_PATTERN.test(code) ? getOrderIdByInvoiceCode(code) : null;
  const order = orderId ? await getOrder(orderId) : null;
  if (!order) return html(invoiceNotFoundPage(), 404);
  return html(await buildInvoiceHtml(order), 200);
}
