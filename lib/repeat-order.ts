// "Repetir orden": turn a past order into a fresh intake draft. Pure, so the
// intake page can build it on the server and the form just loads it.
//
// What carries over is who and what (buyer, recipient, address, pieces, funeral
// flag); what starts fresh is when and how it gets paid (date, card message,
// payment, promo, manual totals). Catalog lines are re-priced by the form from
// today's catalog because a line stores no price; custom lines keep theirs.
import type { CartLine, Order } from "@/types/order";
import type { Product } from "@/types/product";
import type { DraftPayload } from "@/types/draft";
import { addOnsForProduct } from "@/lib/product-add-ons";
import {
  INITIAL_CUSTOMER,
  INITIAL_PAYMENT,
  makeInitialFulfillment,
  type Channel,
} from "@/components/admin/intake/intake-initial-state";

export type RepeatedOrder = {
  payload: DraftPayload;
  /** The order being repeated, for the "Repitiendo la orden #…" banner. */
  from: { id: string; orderNumber?: number; createdAt: string };
  /** Last time's card message, offered with one click instead of copied. */
  previousCardMessage: string;
  /** Pieces left out because they are no longer on sale, by name. */
  dropped: { en: string; es: string }[];
};

function droppedName(line: Extract<CartLine, { kind: "catalog" }>, product: Product | undefined) {
  if (!product) return { en: line.productId, es: line.productId };
  const variant = product.variants.find((v) => v.id === line.variantId);
  // "Standard" is the default size: naming it adds nothing.
  const size = (lang: "en" | "es") =>
    line.variantId === "standard" ? "" : ` (${variant ? variant.label[lang] : line.variantId})`;
  return { en: product.title.en + size("en"), es: product.title.es + size("es") };
}

export function repeatOrderPayload(order: Order, products: readonly Product[]): RepeatedOrder {
  const lines: CartLine[] = [];
  const dropped: RepeatedOrder["dropped"] = [];
  for (const line of order.lines) {
    if (line.kind !== "catalog") {
      lines.push(line);
      continue;
    }
    const product = products.find((p) => p.id === line.productId);
    const onSale =
      product?.active && !product.quoteOnly && product.variants.some((v) => v.id === line.variantId);
    if (!product || !onSale) {
      dropped.push(droppedName(line, product));
      continue;
    }
    const offered = new Set(addOnsForProduct(product).map((a) => a.id));
    lines.push({ ...line, addOnIds: line.addOnIds.filter((id) => offered.has(id)) });
  }

  const fresh = makeInitialFulfillment();
  const f = order.fulfillment;
  // A web order repeated by staff is a phone order: the buyer is calling it in.
  const channel: Channel = order.source === "web" ? "phone" : order.source;

  return {
    payload: {
      version: 1,
      channel,
      customer: {
        ...INITIAL_CUSTOMER,
        name: order.contact.name ?? "",
        phone: order.contact.phone,
        email: order.contact.email ?? "",
        locale: order.locale,
      },
      fulfillment: {
        ...fresh,
        method: f.method,
        recipient: { ...f.recipient },
        address: f.method === "delivery" ? { ...f.address } : fresh.address,
        funeral: order.funeral ?? false,
      },
      lines,
      override: {},
      giftCardCode: "",
      payment: { ...INITIAL_PAYMENT },
    },
    from: { id: order.id, orderNumber: order.orderNumber, createdAt: order.createdAt },
    previousCardMessage: f.cardMessage ?? "",
    dropped,
  };
}
