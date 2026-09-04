import "server-only";
import type { MessageTemplate } from "@/lib/message-storage";

export type TemplateVars = {
  /** The person who PAID (order.contact) — every customer SMS goes to their phone,
   *  so buyer-facing messages greet them, not the flower recipient. */
  buyer_name: string;
  recipient_name: string;
  total: string;
  window?: string;
  /** Method-aware word before the window: "Delivery"/"Entrega" for delivery,
   *  "Pickup"/"Recoger" for pickup/in-store. Defaults to the delivery word when
   *  a caller doesn't supply it, preserving prior behavior. */
  fulfillment_label?: string;
  link?: string;
  shop_phone: string;
  order_number?: string;
};

/** "Orden #1042, total $89.50." — or just "Total $89.50." when the order predates
 *  sequential numbering. Capitalisation differs between the two, so this cannot
 *  be a simple optional suffix. */
function totalSentence(v: TemplateVars, locale: "en" | "es"): string {
  const label = locale === "es" ? "Orden" : "Order";
  return v.order_number
    ? `${label} #${v.order_number}, total ${v.total}.`
    : `Total ${v.total}.`;
}

const BODIES: Record<"en" | "es", Record<MessageTemplate, (v: TemplateVars) => string>> = {
  en: {
    order_received: (v) =>
      `Hi ${v.buyer_name}, Diva Flowers got your order. Total ${v.total}. ${v.fulfillment_label ?? "Delivery"} ${v.window ?? ""}. Thanks! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hi ${v.buyer_name}, your Diva Flowers order is reserved. Total ${v.total}. Pay here: ${v.link ?? ""}. We'll confirm once paid. — Maky`,
    payment_confirmed: (v) =>
      `Thanks ${v.buyer_name}! Diva Flowers received your payment. ${totalSentence(v, "en")} ${v.fulfillment_label ?? "Delivery"} ${v.window ?? ""}. — Maky`,
    out_for_delivery: (v) =>
      `Hi ${v.buyer_name}! Your Diva Flowers order is on the way, arriving ${v.window ?? ""}. — Maky`,
    ready_for_pickup: (v) =>
      `Hi ${v.buyer_name}! Your Diva Flowers order is ready for pickup. See you soon! — Maky · ${v.shop_phone}`,
    delivered: (v) =>
      `Delivered! Your Diva Flowers order has arrived. Thank you! — Maky · ${v.shop_phone}`,
    review_request: (v) =>
      `Hi ${v.buyer_name}, thanks for choosing Diva Flowers! Would you leave us a quick Google review? ${v.link ?? ""} — Maky`,
  },
  es: {
    order_received: (v) =>
      `Hola ${v.buyer_name}, Diva Flowers recibió tu pedido. Total ${v.total}. ${v.fulfillment_label ?? "Entrega"} ${v.window ?? ""}. ¡Gracias! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hola ${v.buyer_name}, tu pedido en Diva Flowers está reservado. Total ${v.total}. Paga aquí: ${v.link ?? ""}. Lo confirmamos al recibir el pago. — Maky`,
    payment_confirmed: (v) =>
      `¡Gracias ${v.buyer_name}! Diva Flowers recibió tu pago. ${totalSentence(v, "es")} ${v.fulfillment_label ?? "Entrega"} ${v.window ?? ""}. — Maky`,
    out_for_delivery: (v) =>
      `¡Hola ${v.buyer_name}! Tu pedido de Diva Flowers va en camino, llega ${v.window ?? ""}. — Maky`,
    ready_for_pickup: (v) =>
      `¡Hola ${v.buyer_name}! Tu pedido de Diva Flowers está listo para recoger. ¡Te esperamos! — Maky · ${v.shop_phone}`,
    delivered: (v) =>
      `¡Entregado! Tu pedido de Diva Flowers ya llegó. ¡Gracias por tu compra! — Maky · ${v.shop_phone}`,
    review_request: (v) =>
      `¡Hola ${v.buyer_name}! Gracias por elegir Diva Flowers 🌸 ¿Nos dejas una reseña en Google? ${v.link ?? ""} — Maky`,
  },
};

export function renderSmsBody(
  template: MessageTemplate,
  locale: "en" | "es",
  vars: TemplateVars,
): string {
  return BODIES[locale][template](vars);
}

export function whatsappContentVars(
  template: MessageTemplate,
  vars: TemplateVars,
): Record<string, string> {
  switch (template) {
    case "order_received":
      return { "1": vars.recipient_name, "2": vars.total, "3": vars.window ?? "", "4": vars.shop_phone };
    case "payment_link":
      return { "1": vars.recipient_name, "2": vars.total, "3": vars.link ?? "" };
    case "payment_confirmed":
      return { "1": vars.recipient_name, "2": vars.window ?? "", "3": vars.order_number ?? "" };
    case "out_for_delivery":
      return { "1": vars.buyer_name, "2": vars.window ?? "" };
    case "ready_for_pickup":
      return { "1": vars.buyer_name, "2": vars.shop_phone };
    case "delivered":
      return { "1": vars.buyer_name, "2": vars.shop_phone };
    case "review_request":
      return { "1": vars.buyer_name, "2": vars.link ?? "" };
  }
}

export function whatsappContentSid(
  template: MessageTemplate,
  locale: "en" | "es",
): string | null {
  const key = `TWILIO_TEMPLATE_${template.toUpperCase()}_${locale.toUpperCase()}`;
  const sid = process.env[key];
  return sid && sid.length > 0 ? sid : null;
}
