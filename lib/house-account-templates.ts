// Pure. SMS bodies and email subject for house-account statements. These are
// transactional (a bill the customer agreed to), so no opt-out footer — same
// as payment_link in lib/messaging-templates.ts.
import { formatMoneyCents } from "@/lib/format";
import { formatDateOnly } from "@/lib/format-datetime";
import type { SendKind } from "@/types/house-account";

export type StatementTemplate = "statement" | "reminder" | "overdue";
export type TemplateVars = { number: string; amountCents: number; dueDate: string; link: string };

type Locale = "en" | "es";
type Rendered = { number: string; amount: string; due: string; link: string };

const BODIES: Record<StatementTemplate, Record<Locale, (r: Rendered) => string>> = {
  statement: {
    es: (r) => `Diva Flowers: tu estado de cuenta ${r.number} por ${r.amount} vence el ${r.due}. Ver y pagar: ${r.link}`,
    en: (r) => `Diva Flowers: your statement ${r.number} for ${r.amount} is due ${r.due}. View and pay: ${r.link}`,
  },
  reminder: {
    es: (r) => `Recordatorio Diva Flowers: el estado ${r.number} por ${r.amount} vence el ${r.due}. ${r.link}`,
    en: (r) => `Reminder from Diva Flowers: statement ${r.number} for ${r.amount} is due ${r.due}. ${r.link}`,
  },
  overdue: {
    es: (r) => `Diva Flowers: el estado ${r.number} por ${r.amount} venció el ${r.due}. Paga aquí: ${r.link}`,
    en: (r) => `Diva Flowers: statement ${r.number} for ${r.amount} was due ${r.due}. Pay here: ${r.link}`,
  },
};

export function renderSms(t: StatementTemplate, locale: Locale, v: TemplateVars): string {
  return BODIES[t][locale]({
    number: v.number,
    amount: formatMoneyCents(v.amountCents, locale),
    due: formatDateOnly(v.dueDate, locale),
    link: v.link,
  });
}

export function emailSubject(locale: Locale, number: string): string {
  return locale === "es" ? `Estado de cuenta ${number} · Diva Flowers` : `Statement ${number} · Diva Flowers`;
}

export function statementUrl(code: string): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  return `${base}/s/${code}`;
}

/** The statement send uses the statement text; anything else is a reminder until the due date passes. */
export function pickTemplate(kind: SendKind, today: string, dueDate: string): StatementTemplate {
  if (kind === "statement") return "statement";
  return today <= dueDate ? "reminder" : "overdue";
}
