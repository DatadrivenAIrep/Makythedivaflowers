// lib/invoice-sender.ts
// Sends an order's invoice to the customer by SMS (a short text with the public
// /i/<code> link) and/or email (the full invoice in the body). Recipients default
// to the buyer on the order; staff may override them (e.g. a company's AP email).
// Every attempt that reaches a provider is logged in `messages` as "invoice", so
// it shows in the order's message list and the inbox.
import "server-only";
import { Resend } from "resend";
import { SITE } from "@/data/site";
import { sendMessage } from "@/lib/messaging";
import { insertMessage, updateMessage } from "@/lib/message-storage";
import { getByPhoneUS, normalizePhone } from "@/lib/customer-storage";
import { ensureInvoiceCode, invoiceUrl, siteBaseUrl } from "@/lib/invoice-links";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import { buildInvoiceModel } from "@/lib/invoice";
import type { Order } from "@/types/order";

export type InvoiceChannel = "sms" | "email" | "both";
export type InvoiceSendRequest = { channel: InvoiceChannel; phone?: string; email?: string };
export type ChannelResult = { status: "sent" | "skipped" | "failed"; error?: string };
export type InvoiceSendResult = { link: string; sms?: ChannelResult; email?: ChannelResult };

function result(status: ChannelResult["status"], error?: string): ChannelResult {
  return error ? { status, error } : { status };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.ORDER_NOTIFICATIONS_FROM;
}

/** US digits without the country code: "+1 (516) 555-0199" → "5165550199". */
function usDigits(phone: string): string {
  const d = normalizePhone(phone);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

function firstName(full: string | undefined): string {
  return full?.trim().split(/\s+/)[0] ?? "";
}

export function invoiceEmailSubject(locale: "en" | "es", number: string): string {
  return locale === "es" ? `Factura ${number} · Diva Flowers` : `Invoice ${number} · Diva Flowers`;
}

async function sendSmsInvoice(
  order: Order, locale: "en" | "es", phoneIn: string, number: string, link: string,
): Promise<ChannelResult> {
  const phone = usDigits(phoneIn);
  if (!phone) return result("skipped", "no_phone");
  const known = getByPhoneUS(phone);
  if (known?.messagingChannel === "none") return result("skipped", "opted_out");
  const res = await sendMessage({
    orderId: order.id,
    customerId: known?.id,
    channel: "sms",
    locale,
    template: "invoice",
    vars: {
      buyer_name: firstName(order.contact.name),
      recipient_name: firstName(order.fulfillment.recipient.name),
      total: `$${(order.totals.totalCents / 100).toFixed(2)}`,
      invoice_number: number,
      link,
      shop_phone: SITE.phoneDisplay,
    },
    to: { phone },
  });
  return result(res.status, res.error);
}

async function sendEmailInvoice(
  order: Order, locale: "en" | "es", to: string, number: string, link: string,
): Promise<ChannelResult> {
  if (!to) return result("skipped", "no_email");
  if (!emailConfigured()) return result("skipped", "email_not_configured");
  const subject = invoiceEmailSubject(locale, number);
  const id = insertMessage({ orderId: order.id, channel: "email", template: "invoice", locale, toEmail: to, body: subject });
  try {
    const html = await buildInvoiceHtml(order, { forEmail: { link, logoUrl: `${siteBaseUrl()}/print/logo.jpg` } });
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const sent = await resend.emails.send({
      from: process.env.ORDER_NOTIFICATIONS_FROM!,
      to,
      replyTo: SITE.email,
      subject,
      html,
    });
    if (sent.error) throw new Error(sent.error.message ?? String(sent.error));
    updateMessage(id, { status: "sent", providerSid: sent.data?.id ?? "sent", body: subject });
    return result("sent");
  } catch (e) {
    const msg = errMsg(e);
    updateMessage(id, { status: "failed", error: msg, body: subject });
    return result("failed", msg);
  }
}

export async function sendInvoice(order: Order, req: InvoiceSendRequest): Promise<InvoiceSendResult> {
  const locale = order.locale === "es" ? "es" : "en";
  const link = invoiceUrl(ensureInvoiceCode(order.id));
  const { number } = buildInvoiceModel(order);
  const out: InvoiceSendResult = { link };
  if (req.channel !== "email") {
    out.sms = await sendSmsInvoice(order, locale, req.phone ?? order.contact.phone ?? "", number, link);
  }
  if (req.channel !== "sms") {
    out.email = await sendEmailInvoice(order, locale, (req.email ?? order.contact.email ?? "").trim(), number, link);
  }
  return out;
}
