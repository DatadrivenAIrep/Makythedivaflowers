export type PaidEvent = { orderId: string; at: string; recipientName: string };

/** Paid orderIds not present in `seen`. Pure. */
export function newPaidIds(events: PaidEvent[], seen: Set<string>): string[] {
  const out: string[] = [];
  for (const e of events) if (!seen.has(e.orderId)) out.push(e.orderId);
  return out;
}

/** Split items into fixed-size pages; always returns at least one (possibly empty) page. */
export function paginate<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));
  return pages.length ? pages : [[]];
}
