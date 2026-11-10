import "server-only";
import { getCustomerById, listTagsFor, type Customer } from "@/lib/customer-storage";
import { listOrdersByCustomer } from "@/lib/order-storage";
import { computeMetrics, type CustomerMetrics } from "@/lib/customer-metrics";
import {
  listDatesFor,
  listPreferencesFor,
  type ImportantDate,
  type PreferencesMap,
} from "@/lib/customer-dates-storage";
import { findAccountForCustomer } from "@/lib/house-account-storage";
import { recipientsForSender, type KnownRecipient } from "@/lib/recipient-history";
import { suggestRecipientDates, type DateSuggestion } from "@/lib/date-suggestions";
import { listDismissedSuggestions } from "@/lib/customer-dates-storage";
import { getDatePreferences } from "@/lib/date-preferences-storage";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import type { AccountDate } from "@/lib/account-dates";
import type { Order } from "@/types/order";

export type CustomerProfileData = {
  customer: Customer;
  metrics: CustomerMetrics;
  tags: string[];
  orders: Order[];
  recipients: KnownRecipient[];
  dateSuggestions: DateSuggestion[];
  dates: AccountDate[];
  /** Feature flag: the panel only renders source, likes and avoid when on. */
  showDatePrefs: boolean;
  preferences: PreferencesMap;
  houseAccount?: { id: string; name: string };
};

export function getCustomerProfile(id: string, now: Date = new Date()): CustomerProfileData | null {
  const customer = getCustomerById(id);
  if (!customer) return null;
  const orders = listOrdersByCustomer(id);
  const metrics = computeMetrics(
    orders.map((o) => ({
      totalCents: o.totals.totalCents,
      amountPaidCents: o.amountPaidCents ?? 0,
      createdAt: o.createdAt,
    })),
    now,
    {
      orderCount: customer.orderCount,
      firstSeenAt: customer.firstSeenAt,
      lastSeenAt: customer.lastSeenAt,
    },
  );
  const acct = findAccountForCustomer(id);
  const recipients = recipientsForSender({ customerId: id, phone: customer.phone });
  const dates = listDatesFor(id, now);
  return {
    customer,
    metrics,
    tags: listTagsFor(id),
    orders,
    recipients,
    dateSuggestions: dateSuggestionsFor(id, recipients, dates),
    dates: dates.map((d) => ({ ...d, prefs: getDatePreferences(d.id) })),
    showDatePrefs: dateRewardsEnabled(),
    preferences: listPreferencesFor(id),
    ...(acct ? { houseAccount: { id: acct.id, name: acct.name } } : {}),
  };
}

export function dateSuggestionsFor(
  customerId: string,
  recipients: KnownRecipient[],
  dates: ImportantDate[],
): DateSuggestion[] {
  return suggestRecipientDates({
    recipients,
    saved: dates,
    dismissed: listDismissedSuggestions(customerId),
  });
}
