import "server-only";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";
import { getByOrder } from "@/lib/digital-cards";

// The sheet for a stored order: the digital-card QR when the order has one,
// otherwise the website QR.
export async function buildOrderSheetHtml(order: Order): Promise<string> {
  const card = getByOrder(order.id);
  return buildSheetHtml(order, card ? { digitalCardUrl: card.shortUrl } : {});
}
