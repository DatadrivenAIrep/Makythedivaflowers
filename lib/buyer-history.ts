import { getDb } from "@/lib/db";

/**
 * Has this buyer paid for an order before?
 *
 * Gates first-order promo codes. Matched on phone and email rather than on a
 * customer id, because web checkout is guest-only — there is no account to key
 * off, and the same person can order without ever being linked to a customer
 * row. Phone is compared on digits alone, since a buyer may type "(516) 555-0123"
 * one time and "5165550123" the next.
 *
 * Only paid orders count: an abandoned or failed checkout should not cost
 * someone their welcome offer.
 */
export function buyerHasPaidOrder(input: { phone?: string; email?: string }): boolean {
  const digits = input.phone?.replace(/\D/g, "") ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!digits && !email) return false;

  const db = getDb();
  if (digits) {
    const hit = db
      .prepare(
        `SELECT 1 FROM orders
          WHERE payment_status = 'paid'
            AND REPLACE(REPLACE(REPLACE(REPLACE(contact_phone, '-', ''), ' ', ''), '(', ''), ')', '') LIKE ?
          LIMIT 1`,
      )
      .get(`%${digits}`);
    if (hit) return true;
  }
  if (email) {
    const hit = db
      .prepare(
        "SELECT 1 FROM orders WHERE payment_status = 'paid' AND LOWER(contact_email) = ? LIMIT 1",
      )
      .get(email);
    if (hit) return true;
  }
  return false;
}
