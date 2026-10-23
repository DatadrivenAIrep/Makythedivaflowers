// Cierre del día: the day's money per method and the cash-drawer cuadre. Pure:
// the API computes it for the screen and again when saving, never trusting the client.
import type { PaymentKind, PaymentRowMethod } from "@/lib/payments-storage";

export type MoneyMethod = Exclude<PaymentRowMethod, "gift-card">;
export const MONEY_METHODS: MoneyMethod[] = ["cash", "zelle", "card-terminal", "ach", "check", "stripe", "unknown"];

export type DaySummary = {
  byMethod: Record<MoneyMethod, number>;
  /** Cash taken in (payments, deposits, balances, gift-card sales). */
  cashInCents: number;
  /** Cash handed back, as a positive number. */
  cashRefundsCents: number;
  /** Paid with gift cards sold earlier: value used, not money in. */
  giftCardRedeemedCents: number;
  /** Net money collected across methods (refunds subtracted). */
  totalCollectedCents: number;
};

export function summarizeDay(rows: { method: PaymentRowMethod; kind: PaymentKind; amountCents: number }[]): DaySummary {
  const byMethod = Object.fromEntries(MONEY_METHODS.map((m) => [m, 0])) as Record<MoneyMethod, number>;
  let cashIn = 0;
  let cashRefunds = 0;
  let giftCard = 0;
  for (const r of rows) {
    if (r.method === "gift-card") {
      giftCard += r.amountCents;
      continue;
    }
    byMethod[r.method] += r.amountCents;
    if (r.method === "cash") {
      if (r.kind === "refund") cashRefunds += -r.amountCents;
      else cashIn += r.amountCents;
    }
  }
  const total = MONEY_METHODS.reduce((s, m) => s + byMethod[m], 0);
  return { byMethod, cashInCents: cashIn, cashRefundsCents: cashRefunds, giftCardRedeemedCents: giftCard, totalCollectedCents: total };
}

export function expectedCash(i: { openingFloatCents: number; cashInCents: number; cashRefundsCents: number; cashOutCents: number }): number {
  return i.openingFloatCents + i.cashInCents - i.cashRefundsCents - i.cashOutCents;
}

/** Counted minus expected: negative means cash is missing. */
export function closeDifference(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}

/** How much the day's money moved since the close was saved (0 = nothing new). */
export function changeSinceClose(live: DaySummary, saved: DaySummary): number {
  const total = live.totalCollectedCents - saved.totalCollectedCents;
  if (total !== 0) return total;
  const moved = MONEY_METHODS.find((m) => live.byMethod[m] !== (saved.byMethod[m] ?? 0));
  return moved ? live.byMethod[moved] - (saved.byMethod[moved] ?? 0) : 0;
}

/** "$1,234.50" / "12,50" / "12" → cents; anything else (or negative) → null. */
export function parseMoneyCents(text: string): number | null {
  let s = text.trim().replace(/^\$/, "").trim();
  if (!s) return null;
  // A single comma with 1–2 trailing digits is a decimal comma ("12,50").
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
