"use client";
import type { Order } from "@/types/order";

export type PendingReason =
  | "delivery_today_unpaid" | "pickup_today_unpaid"
  | "delivery_today_undispatched" | "intake_unpaid_stale" | "web_unacknowledged";

export type PendingActionId =
  | "open" | "whatsapp" | "call" | "resend_link" | "mark_paid"
  | "advance_preparing" | "advance_out" | "advance_delivered";

type Props = {
  order: Order;
  reason: PendingReason;
  onOpen: (orderId: string) => void;
  onAction: (orderId: string, action: PendingActionId) => void;
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  web: { label: "WEB", cls: "bg-red-100 text-red-700" },
  "walk-in": { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  phone: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  whatsapp: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
  event: { label: "INTAKE", cls: "bg-emerald-100 text-emerald-700" },
};

const URGENCY_BORDER: Record<PendingReason, string> = {
  delivery_today_unpaid: "border-l-red-500",
  pickup_today_unpaid: "border-l-orange-500",
  delivery_today_undispatched: "border-l-amber-500",
  intake_unpaid_stale: "border-l-amber-400",
  web_unacknowledged: "border-l-rose-400",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function recipientText(o: Order): string {
  if (o.fulfillment.method === "delivery") return `${o.fulfillment.address.city} ${o.fulfillment.address.zip}`;
  if (o.fulfillment.method === "pickup") return "Pickup en tienda";
  return "En tienda";
}

function whenText(o: Order): string {
  if (o.fulfillment.method === "in-store") return "Ahora";
  const today = new Date().toISOString().slice(0, 10);
  const d = o.fulfillment.window.date;
  const prefix = d === today ? "HOY" : d;
  return `${prefix} · ${o.fulfillment.window.slot}`;
}

function itemsSummary(o: Order): string {
  if (o.lines.length === 0) return "—";
  const first = o.lines[0];
  const head = first.kind === "catalog" ? first.productId : first.title;
  return o.lines.length > 1 ? `${head} + ${o.lines.length - 1} más` : head;
}

function actionsFor(reason: PendingReason): { id: PendingActionId; label: string }[] {
  switch (reason) {
    case "delivery_today_unpaid":
    case "pickup_today_unpaid":
    case "intake_unpaid_stale":
      return [
        { id: "whatsapp", label: "📞 WhatsApp" },
        { id: "resend_link", label: "↻ Reenviar link" },
        { id: "mark_paid", label: "✓ Marcar pagado" },
      ];
    case "delivery_today_undispatched":
      return [
        { id: "advance_preparing", label: "📦 Preparar" },
        { id: "advance_out", label: "🚚 En camino" },
        { id: "advance_delivered", label: "✓ Entregada" },
      ];
    case "web_unacknowledged":
      return [{ id: "open", label: "Abrir detalle →" }];
  }
}

export default function PendingCard({ order, reason, onOpen, onAction }: Props) {
  const badge = SOURCE_BADGE[order.source] ?? { label: order.source.toUpperCase(), cls: "bg-stone-100 text-stone-700" };
  const actions = actionsFor(reason);
  return (
    <article className={`border-l-4 ${URGENCY_BORDER[reason]} rounded-r bg-bone shadow-sm`}>
      <div className="p-3 cursor-pointer" data-testid="pending-card-body" onClick={() => onOpen(order.id)}>
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
          <span className="font-semibold">{order.fulfillment.recipient.name}</span>
          <span className="text-xs text-ink/50">· #{order.id.slice(-6)}</span>
          <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
        </div>
        <p className="mt-1 text-sm text-ink/70">{itemsSummary(order)}</p>
        <p className="mt-1 text-xs text-ink/60">
          {order.paymentStatus === "paid" ? "● Pagado" : "● Pago pendiente"} · → {whenText(order)} · {recipientText(order)}
        </p>
      </div>
      <div className="flex gap-2 border-t border-ink/5 px-3 py-2">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={(e) => { e.stopPropagation(); onAction(order.id, a.id); }}
            className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5"
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}
