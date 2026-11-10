import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addTag, removeTag } from "@/lib/customer-storage";

/**
 * Promotional-SMS permission, independent of `messaging_channel` (which only
 * governs order/delivery texts). The `sms-marketing` tag is the permission;
 * `sms_stopped_at` records that the number replied STOP (or Twilio answered
 * 21610) and blocks new grants until START.
 */

export type SmsPermission = "granted" | "stopped" | "none";

export const PROMO_CONSENT_TEXT_VERSION = "2026-11-09";

const TAG = "sms-marketing";

function logId(): string {
  return `mcl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function writeLog(customerId: string, action: "grant" | "revoke", source: "date_prompt" | "account", ip: string) {
  getDb()
    .prepare(
      `INSERT INTO marketing_consent_log (id, customer_id, action, source, ip, text_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(logId(), customerId, action, source, ip, PROMO_CONSENT_TEXT_VERSION, new Date().toISOString());
}

export function smsPermission(customerId: string): SmsPermission {
  runMigrations();
  const db = getDb();
  const c = db
    .prepare("SELECT sms_stopped_at FROM customers WHERE id = ?")
    .get(customerId) as { sms_stopped_at: string | null } | undefined;
  if (c?.sms_stopped_at) return "stopped";
  const t = db
    .prepare("SELECT 1 FROM customer_tags WHERE customer_id = ? AND tag = ?")
    .get(customerId, TAG);
  return t ? "granted" : "none";
}

export function grantPromoConsent(
  customerId: string,
  ctx: { source: "date_prompt" | "account"; ip: string },
): SmsPermission {
  if (smsPermission(customerId) === "stopped") return "stopped";
  addTag(customerId, TAG);
  writeLog(customerId, "grant", ctx.source, ctx.ip);
  return "granted";
}

export function revokePromoConsent(customerId: string, ctx: { source: "account"; ip: string }): void {
  runMigrations();
  removeTag(customerId, TAG);
  writeLog(customerId, "revoke", ctx.source, ctx.ip);
}

export function markSmsStopped(customerId: string, now: Date = new Date()): void {
  runMigrations();
  getDb().prepare("UPDATE customers SET sms_stopped_at = ? WHERE id = ?").run(now.toISOString(), customerId);
}

export function clearSmsStopped(customerId: string): void {
  runMigrations();
  getDb().prepare("UPDATE customers SET sms_stopped_at = NULL WHERE id = ?").run(customerId);
}
