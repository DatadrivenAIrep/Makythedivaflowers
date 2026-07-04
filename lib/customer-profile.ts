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
import type { Order } from "@/types/order";

export type CustomerProfileData = {
  customer: Customer;
  metrics: CustomerMetrics;
  tags: string[];
  orders: Order[];
  dates: ImportantDate[];
  preferences: PreferencesMap;
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
    { firstSeenAt: customer.firstSeenAt, lastSeenAt: customer.lastSeenAt },
  );
  return {
    customer,
    metrics,
    tags: listTagsFor(id),
    orders,
    dates: listDatesFor(id, now),
    preferences: listPreferencesFor(id),
  };
}
