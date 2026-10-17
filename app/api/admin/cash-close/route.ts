import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { shopDateStr } from "@/lib/tv-slots";
import { listPaymentsForDay, firstPaymentDay, type PaymentRow } from "@/lib/payments-storage";
import { summarizeDay, changeSinceClose, MONEY_METHODS } from "@/lib/cash-close";
import { getClose, putClose, previousFloatCents, listCloses } from "@/lib/cash-close-storage";

export const runtime = "nodejs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const putBody = z.object({
  day: z.string().regex(DAY),
  openingFloatCents: z.number().int().min(0),
  cashOutCents: z.number().int().min(0),
  cashOutNote: z.string().max(200).optional(),
  countedCents: z.number().int().min(0),
  floatLeftCents: z.number().int().min(0),
  reviewed: z.array(z.enum(MONEY_METHODS as [string, ...string[]])),
  note: z.string().max(500).optional(),
});

type PaymentJoinRow = { id: string; order_number: number | null; contact_name: string | null };

/** The day's payments in the order they happened, each with its order's number and customer. */
function paymentsWithOrder(day: string): (PaymentRow & { orderNumber?: number; customerName?: string })[] {
  const joins = getDb()
    .prepare(
      `SELECT p.id, o.order_number, o.contact_name FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id WHERE p.day = ? ORDER BY p.at, p.rowid`,
    )
    .all(day) as PaymentJoinRow[];
  const byId = new Map(listPaymentsForDay(day).map((p) => [p.id, p]));
  return joins.flatMap((j) => {
    const p = byId.get(j.id);
    if (!p) return [];
    return [{
      ...p,
      ...(j.order_number != null ? { orderNumber: j.order_number } : {}),
      ...(j.contact_name ? { customerName: j.contact_name } : {}),
    }];
  });
}

type OrderRow = {
  created_at: string; subtotal_cents: number; tax_cents: number; tip_cents: number | null; delivery_cents: number;
  discount_cents: number | null; total_cents: number; amount_paid_cents: number; payment_status: string; fulfillment_status: string;
};

/** The shop day's orders (canceled ones excluded). Pending counts only unpaid balances of still-pending orders. */
function salesForDay(day: string) {
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString();
  const end = new Date(Date.parse(`${day}T00:00:00Z`) + 2 * DAY_MS).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT created_at, subtotal_cents, tax_cents, tip_cents, delivery_cents, discount_cents, total_cents,
              amount_paid_cents, payment_status, fulfillment_status
       FROM orders WHERE created_at >= ? AND created_at < ?`,
    )
    .all(start, end) as OrderRow[];
  const sales = { orders: 0, subtotalCents: 0, taxCents: 0, tipCents: 0, deliveryCents: 0, discountCents: 0, pendingCents: 0 };
  for (const r of rows) {
    if (r.fulfillment_status === "canceled" || shopDateStr(new Date(r.created_at)) !== day) continue;
    sales.orders += 1;
    sales.subtotalCents += r.subtotal_cents;
    sales.taxCents += r.tax_cents;
    sales.tipCents += r.tip_cents ?? 0;
    sales.deliveryCents += r.delivery_cents;
    sales.discountCents += r.discount_cents ?? 0;
    if (r.payment_status === "pending") sales.pendingCents += Math.max(0, r.total_cents - r.amount_paid_cents);
  }
  return sales;
}

export async function GET(req: Request): Promise<Response> {
  const param = new URL(req.url).searchParams.get("day");
  const day = param ?? shopDateStr(new Date());
  if (!DAY.test(day)) return NextResponse.json({ error: "invalid_day" }, { status: 400 });

  const payments = paymentsWithOrder(day);
  const summary = summarizeDay(payments);
  const close = getClose(day);
  return NextResponse.json({
    day,
    firstDay: firstPaymentDay(),
    payments,
    summary,
    close,
    changeSinceCloseCents: close ? changeSinceClose(summary, close.totals) : 0,
    previousFloatCents: previousFloatCents(day),
    sales: salesForDay(day),
    history: listCloses(),
  });
}

export async function PUT(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = putBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  const close = putClose({ ...parsed.data, actor: "maky" });
  return NextResponse.json({ close });
}
