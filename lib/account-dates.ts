import "server-only";
import { withTransaction } from "@/lib/db-tx";
import { isValidMonthDay } from "@/lib/customer-dates";
import {
  addImportantDate,
  listDatesFor,
  recipientMatcher,
  type ImportantDate,
} from "@/lib/customer-dates-storage";
import { getDatePreferences, preferencesForRecipient, setDatePreferences, type DatePreferences } from "@/lib/date-preferences-storage";
import type { DateSuggestion } from "@/lib/date-suggestions";
import { dateSuggestionsFor } from "@/lib/customer-profile";
import { getCustomerById } from "@/lib/customer-storage";
import { recipientsForSender } from "@/lib/recipient-history";
import { listOrdersByCustomer } from "@/lib/order-storage";
import { getPricedProducts } from "@/lib/product-prices";
import { isSympathyProduct } from "@/lib/product-add-ons";
import { smsPermission, type SmsPermission } from "@/lib/promo-consent";
import { claimBonus, runBonus } from "@/lib/loyalty-bonus";

/** Most dates one customer can keep, whoever saved them. */
export const MAX_DATES = 12;

export const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u;
export const NAME_MAX = 40;

/**
 * Phones type "O’Brien" with a curly apostrophe, and some send "José" decomposed
 * (e + combining accent): both are ordinary names, so they are folded to the plain
 * apostrophe and the composed form before the check, and stored that way.
 */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/[’‘]/g, "'").trim();
}

/**
 * A name a date can be saved under, once normalised (normalizeName): starts with a
 * letter, then letters, spaces, . ' -; at most NAME_MAX. Callers store the
 * normalizeName() form, never the raw input.
 */
export function isValidPersonName(raw: string): boolean {
  const name = normalizeName(raw);
  return name.length >= 1 && name.length <= NAME_MAX && NAME_PATTERN.test(name);
}

export type AccountDate = ImportantDate & { prefs: DatePreferences };

export type AccountDatesView = {
  dates: AccountDate[];
  suggestions: DateSuggestion[];
  permission: SmsPermission;
};

/**
 * People the customer sent funeral flowers to. A date is never suggested for them:
 * a "birthday?" prompt next to a loss is exactly the wrong moment. A product that
 * is no longer in the catalog counts as sympathy, since we cannot tell.
 */
function sympathyRecipients(customerId: string): Array<ReturnType<typeof recipientMatcher>> {
  const products = new Map(getPricedProducts().map((p) => [p.id, p]));
  const out: Array<ReturnType<typeof recipientMatcher>> = [];
  for (const order of listOrdersByCustomer(customerId)) {
    const sympathy =
      order.funeral === true ||
      order.lines.some((l) => {
        if (l.kind !== "catalog") return false;
        const p = products.get(l.productId);
        return !p || isSympathyProduct(p);
      });
    if (!sympathy) continue;
    const r = order.fulfillment.recipient;
    out.push(recipientMatcher({ name: r.name, phone: r.phone }));
  }
  return out;
}

export function accountDatesView(customerId: string, now: Date = new Date()): AccountDatesView {
  const dates = listDatesFor(customerId, now);
  const customer = getCustomerById(customerId);
  const recipients = recipientsForSender({ customerId, phone: customer?.phone });
  const excluded = sympathyRecipients(customerId);
  const suggestions = dateSuggestionsFor(customerId, recipients, dates).filter(
    (s) =>
      // Saving a suggestion sends its name as-is and there is no way to edit it here:
      // one the save would reject ("Ana & Luis") is not offered at all.
      isValidPersonName(s.recipientName) &&
      !excluded.some((m) => m({ label: s.recipientName, recipient_phone: s.recipientPhone || null })),
  );
  return {
    dates: dates.map((d) => ({ ...d, prefs: getDatePreferences(d.id) })),
    suggestions,
    permission: smsPermission(customerId),
  };
}

export type AddDateInput = { kind: "birthday" | "anniversary"; name: string; month: number; day: number };

export function addCustomerDate(
  customerId: string,
  input: AddDateInput,
  now: Date = new Date(),
): { ok: true; date: ImportantDate; stamp: boolean } | { ok: false; error: "too_many_dates" | "invalid" } {
  const name = normalizeName(input.name);
  if (!isValidPersonName(name)) return { ok: false, error: "invalid" };
  if (!isValidMonthDay(input.month, input.day)) return { ok: false, error: "invalid" };

  const created = withTransaction((): ImportantDate | "too_many_dates" => {
    const before = listDatesFor(customerId, now);
    // Dates read from order cards are the florist's notes, not the customer's.
    if (before.filter((d) => d.source !== "card").length >= MAX_DATES) return "too_many_dates";
    const known = new Set(before.map((d) => d.id));
    const inherited = preferencesForRecipient(customerId, { name });
    const after = addImportantDate(
      customerId,
      { kind: input.kind, label: name, month: input.month, day: input.day, source: "customer" },
      now,
    );
    const date = after.find((d) => !known.has(d.id));
    if (!date) throw new Error("date not stored");
    if (inherited) setDatePreferences(date.id, inherited);
    return date;
  });
  if (created === "too_many_dates") return { ok: false, error: "too_many_dates" };

  const stamp = claimBonus(customerId, "fecha");
  if (stamp) void runBonus(customerId, "fecha").catch(() => {});
  return { ok: true, date: created, stamp };
}
