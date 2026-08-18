import "server-only";
import type { MessageTemplate } from "@/lib/message-storage";

export type TemplateVars = {
  recipient_name: string;
  total: string;
  window?: string;
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
      `Hi ${v.recipient_name}, Diva Flowers got your order. Total ${v.total}. Delivery ${v.window ?? ""}. Thanks! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hi ${v.recipient_name}, your Diva Flowers order is reserved. Total ${v.total}. Pay here: ${v.link ?? ""}. Delivery confirmed once paid. — Maky`,
    payment_confirmed: (v) =>
      `Thanks ${v.recipient_name}! Diva Flowers received your payment. ${totalSentence(v, "en")} Delivery ${v.window ?? ""}. — Maky`,
  },
  es: {
    order_received: (v) =>
      `Hola ${v.recipient_name}, Diva Flowers recibió tu pedido. Total ${v.total}. Entrega ${v.window ?? ""}. ¡Gracias! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hola ${v.recipient_name}, tu pedido en Diva Flowers está reservado. Total ${v.total}. Paga aquí: ${v.link ?? ""}. Confirmamos la entrega al recibir el pago. — Maky`,
    payment_confirmed: (v) =>
      `¡Gracias ${v.recipient_name}! Diva Flowers recibió tu pago. ${totalSentence(v, "es")} Entrega ${v.window ?? ""}. — Maky`,
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
