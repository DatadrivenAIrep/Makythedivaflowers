import { getByCode } from "@/lib/digital-cards";
import { CODE_PATTERN } from "@/lib/digital-card-code";
import { notFoundPage, preparingPage } from "@/lib/digital-card-pages";
import { getOrder } from "@/lib/order-storage";
import { isAllowedCardUrl } from "@/schemas/digital-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const card = CODE_PATTERN.test(code) ? getByCode(code) : null;
  if (!card) return html(notFoundPage(), 404);
  // Re-checked here too: if the allow-list changes, an old URL stops redirecting.
  if (card.targetUrl && isAllowedCardUrl(card.targetUrl)) {
    return new Response(null, {
      status: 302,
      headers: { location: card.targetUrl, "cache-control": "no-store" },
    });
  }
  const order = await getOrder(card.orderId);
  return html(preparingPage(order?.locale === "en" ? "en" : "es"), 200);
}
