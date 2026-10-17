import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { shopDateStr } from "@/lib/tv-slots";

export type PaymentKind = "payment" | "deposit" | "balance" | "refund" | "gift_card_sale";
export type PaymentRowMethod = "cash" | "zelle" | "card-terminal" | "ach" | "check" | "stripe" | "gift-card" | "unknown";
export type PaymentSource =
  | "intake" | "mark_paid" | "deposit" | "settle" | "stripe_intent" | "stripe_checkout"
  | "house_account" | "house_account_stripe" | "gift_card_admin" | "gift_card_stripe" | "cancel_refund";

export type PaymentRowInput = {
  kind: PaymentKind;
  method: PaymentRowMethod;
  amountCents: number;
  orderId?: string;
  houseAccountId?: string;
  giftCardId?: string;
  source: PaymentSource;
  actor: string;
  note?: string;
  /** Defaults to now. */
  at?: string;
};
export type PaymentRow = PaymentRowInput & { id: string; at: string; day: string };

const LOG_METHODS: PaymentRowMethod[] = ["cash", "zelle", "card-terminal", "ach", "check", "stripe", "gift-card"];

/** An order's payment method as a log method; anything else (house-account, none) is "unknown". */
export function toLogMethod(m: string | undefined): PaymentRowMethod {
  return (LOG_METHODS as string[]).includes(m ?? "") ? (m as PaymentRowMethod) : "unknown";
}

type Row = {
  id: string; at: string; day: string; kind: PaymentKind; method: PaymentRowMethod; amount_cents: number;
  order_id: string | null; house_account_id: string | null; gift_card_id: string | null;
  source: PaymentSource; actor: string; note: string | null;
};

const toPayment = (r: Row): PaymentRow => ({
  id: r.id, at: r.at, day: r.day, kind: r.kind, method: r.method, amountCents: r.amount_cents,
  ...(r.order_id ? { orderId: r.order_id } : {}),
  ...(r.house_account_id ? { houseAccountId: r.house_account_id } : {}),
  ...(r.gift_card_id ? { giftCardId: r.gift_card_id } : {}),
  source: r.source, actor: r.actor, ...(r.note ? { note: r.note } : {}),
});

/** Insert one money event. No transaction of its own: call it inside the writer's. */
export function recordPaymentRow(input: PaymentRowInput): PaymentRow {
  const at = input.at ?? new Date().toISOString();
  const row: PaymentRow = {
    ...input,
    id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at,
    day: shopDateStr(new Date(at)),
  };
  getDb().prepare(
    `INSERT INTO payments (id, at, day, kind, method, amount_cents, order_id, house_account_id, gift_card_id, source, actor, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.at, row.day, row.kind, row.method, row.amountCents, row.orderId ?? null,
    row.houseAccountId ?? null, row.giftCardId ?? null, row.source, row.actor, row.note ?? null);
  return row;
}

/**
 * The day's rows without running migrations, for callers already inside a
 * write transaction (runMigrations takes its own BEGIN IMMEDIATE).
 */
export function readPaymentsForDay(day: string): PaymentRow[] {
  return (getDb().prepare("SELECT * FROM payments WHERE day = ? ORDER BY at, rowid").all(day) as Row[]).map(toPayment);
}

/** Never call inside a transaction: it may run migrations. */
export function listPaymentsForDay(day: string): PaymentRow[] {
  runMigrations();
  return readPaymentsForDay(day);
}

export function firstPaymentDay(): string | null {
  runMigrations();
  const r = getDb().prepare("SELECT MIN(day) AS d FROM payments").get() as { d: string | null };
  return r.d;
}
