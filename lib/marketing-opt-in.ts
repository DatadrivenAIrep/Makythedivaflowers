import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getByPhoneUS, normalizePhone, type Customer } from "@/lib/customer-storage";

/**
 * Record someone who asked for marketing texts but has not ordered.
 *
 * Separate from `upsertOnOrder` on purpose: that function counts an order every
 * time it runs, which is right at checkout and wrong here. Signing up for an
 * offer must not make the CRM think somebody bought something.
 */
export function registerMarketingOptIn(input: {
  phone: string;
  locale: "en" | "es";
  name?: string;
}): Customer {
  runMigrations();
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const now = new Date().toISOString();

  const existing = getByPhoneUS(phone);
  if (existing) {
    db.prepare(
      `UPDATE customers
          SET last_seen_at = ?,
              messaging_channel = CASE WHEN messaging_channel = 'none' THEN 'sms'
                                       ELSE COALESCE(messaging_channel, 'sms') END,
              locale = COALESCE(locale, ?)
        WHERE id = ?`,
    ).run(now, input.locale, existing.id);
    return getByPhoneUS(phone)!;
  }

  const id = `cus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO customers (id, name, phone, locale, messaging_channel, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'sms', 0, ?, ?)`,
  ).run(id, input.name ?? "", phone, input.locale, now, now);
  return getByPhoneUS(phone)!;
}
