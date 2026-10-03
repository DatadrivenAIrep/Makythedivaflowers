// lib/house-account-sender.ts
// Sends one queue row. Resolves which channels are actually usable (phone on
// file and not opted out; email on file and Resend configured), renders the
// right template, sends, and reports an outcome the queue can record.
import "server-only";
import { Resend } from "resend";
import { SITE } from "@/data/site";
import { sendSms } from "@/lib/twilio-server";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { getByPhoneUS } from "@/lib/customer-storage";
import { getAccount } from "@/lib/house-account-storage";
import { getStatement } from "@/lib/house-account-statements";
import { claim, getSend, markSent, markFailed, markSkipped } from "@/lib/house-account-sends";
import { dueCents } from "@/lib/house-account-settlement";
import { renderSms, emailSubject, statementUrl, pickTemplate } from "@/lib/house-account-templates";
import { buildStatementHtml } from "@/lib/house-statement-html";
import type { HouseAccount, ScheduledSend, SendChannel } from "@/types/house-account";

export type SendOutcome = {
  status: "sent" | "skipped" | "failed";
  smsSid?: string;
  emailId?: string;
  body?: string;
  error?: string;
};

function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.ORDER_NOTIFICATIONS_FROM;
}

export function resolveChannels(account: HouseAccount, requested: SendChannel): { sms: boolean; email: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let sms = false;
  let email = false;
  if (requested !== "email") {
    if (!account.billingPhone) reasons.push("sin teléfono");
    else if (getByPhoneUS(account.billingPhone)?.messagingChannel === "none") reasons.push("opt-out SMS");
    else sms = true;
  }
  if (requested !== "sms") {
    if (!account.billingEmail) reasons.push("sin email");
    else if (!emailConfigured()) reasons.push("email no configurado");
    else email = true;
  }
  return { sms, email, reasons };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function sendStep(row: ScheduledSend, today: string): Promise<SendOutcome> {
  const account = getAccount(row.accountId);
  const statement = getStatement(row.statementId);
  if (!account || !statement) return { status: "failed", error: "cuenta o estado inexistente" };
  const ch = resolveChannels(account, row.channel);
  if (!ch.sms && !ch.email) return { status: "skipped", error: ch.reasons.join(", ") };

  const template = pickTemplate(row.kind, today, statement.dueDate);
  const vars = { number: statement.number, amountCents: dueCents(statement), dueDate: statement.dueDate, link: statementUrl(statement.code) };
  const problems: string[] = [...ch.reasons];
  let smsSid: string | undefined;
  let emailId: string | undefined;
  let body: string | undefined;

  if (ch.sms) {
    body = renderSms(template, account.locale, vars);
    try {
      const dry = twilioDryRun() || !twilioSmsEnabled();
      smsSid = dry ? "dry-run" : (await sendSms(account.billingPhone!, body)).sid;
    } catch (e) {
      problems.push(`sms: ${errMsg(e)}`);
    }
  }
  if (ch.email) {
    try {
      const html = await buildStatementHtml(statement, account, { today, forEmail: true });
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: process.env.ORDER_NOTIFICATIONS_FROM!,
        to: account.billingEmail!,
        replyTo: SITE.email,
        subject: emailSubject(account.locale, statement.number),
        html,
      });
      if (result.error) throw new Error(result.error.message ?? String(result.error));
      emailId = result.data?.id ?? "sent";
    } catch (e) {
      problems.push(`email: ${errMsg(e)}`);
    }
  }
  if (!smsSid && !emailId) return { status: "failed", error: problems.join("; ") };
  return { status: "sent", smsSid, emailId, body, ...(problems.length ? { error: problems.join("; ") } : {}) };
}

/** Claim the row, send it, record the outcome. Returns the row as stored afterwards. */
export async function dispatchSend(row: ScheduledSend, today: string): Promise<ScheduledSend> {
  if (!claim(row.id)) return getSend(row.id) ?? row;
  let out: SendOutcome;
  try {
    out = await sendStep(row, today);
  } catch (e) {
    out = { status: "failed", error: errMsg(e) };
  }
  if (out.status === "sent") markSent(row.id, { smsSid: out.smsSid, emailId: out.emailId, body: out.body, error: out.error });
  else if (out.status === "skipped") markSkipped(row.id, out.error ?? "");
  else markFailed(row.id, out.error ?? "error");
  return getSend(row.id) ?? row;
}
