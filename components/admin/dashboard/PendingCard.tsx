"use client";
import Image from "next/image";
import type { Icon } from "@phosphor-icons/react";
import {
  WhatsappLogo, ArrowsClockwise, Check, CheckCircle,
  Package, Truck, ArrowRight, Phone,
} from "@phosphor-icons/react/dist/ssr";
import { resolveLine, firstThumb } from "./product-lookup";
import AdminButton from "./AdminButton";
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

type ActionDef = {
  id: PendingActionId; label: string; icon: Icon;
  variant: "primary" | "secondary";
};

function actionsFor(reason: PendingReason): ActionDef[] {
  switch (reason) {
    case "delivery_today_unpaid":
    case "pickup_today_unpaid":
    case "intake_unpaid_stale":
      return [
        { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogo, variant: "secondary" },
        { id: "resend_link", label: "Reenviar link", icon: ArrowsClockwise, variant: "secondary" },
        { id: "mark_paid", label: "Marcar pagado", icon: Check, variant: "primary" },
      ];
    case "delivery_today_undispatched":
      return [
        { id: "advance_preparing", label: "Preparar", icon: Package, variant: "secondary" },
        { id: "advance_out", label: "En camino", icon: Truck, variant: "secondary" },
        { id: "advance_delivered", label: "Entregada", icon: CheckCircle, variant: "primary" },
      ];
    case "web_unacknowledged":
      return [{ id: "open", label: "Abrir detalle", icon: ArrowRight, variant: "primary" }];
  }
}

export default function PendingCard({ order, reason, onOpen, onAction }: Props) {
  const badge = SOURCE_BADGE[order.source] ?? { label: order.source.toUpperCase(), cls: "bg-stone-100 text-stone-700" };
  const actions = actionsFor(reason);
  const thumb = firstThumb(order);
  const recipientPhone = order.fulfillment.recipient.phone;
  const first = order.lines.length > 0 ? resolveLine(order.lines[0]) : null;
  const itemName = first ? first.name + (order.lines.length > 1 ? ` + ${order.lines.length - 1} más` : "") : "—";
  const itemVariant = first?.variantLabel ?? null;
  const itemAddOns = first?.addOnLabels ?? [];
  return (
    <article className={`border-l-4 ${URGENCY_BORDER[reason]} rounded-r bg-bone shadow-sm`}>
      <div className="p-3 cursor-pointer" data-testid="pending-card-body" onClick={() => onOpen(order.id)}>
        <div className="flex items-start gap-3">
          {thumb && (
            <Image
              src={thumb}
              alt={itemName}
              width={48}
              height={60}
              className="rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
              <span className="font-semibold">{order.fulfillment.recipient.name}</span>
              <span className="text-xs text-ink/50">· #{order.id.slice(-6)}</span>
              <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
            </div>
            <p className="mt-1 text-sm text-ink/70">
              {itemName}
              {itemVariant && <span className="ml-1 text-xs text-ink/50">· {itemVariant}</span>}
            </p>
            {itemAddOns.length > 0 && (
              <p className="mt-0.5 text-xs text-emerald-700">+ {itemAddOns.join(", ")}</p>
            )}
            <p className="mt-1 text-xs text-ink/60">
              {order.paymentStatus === "paid" ? "● Pagado" : "● Pago pendiente"} · → {whenText(order)} · {recipientText(order)}
            </p>
            {recipientPhone && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/60">
                <Phone size={12} weight="bold" />
                <a href={`tel:${recipientPhone}`} onClick={(e) => e.stopPropagation()} className="underline">{recipientPhone}</a>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-ink/5 px-3 py-2">
        {actions.map((a) => (
          <AdminButton
            key={a.id}
            variant={a.variant}
            icon={a.icon}
            onClick={(e) => { e.stopPropagation(); onAction(order.id, a.id); }}
          >
            {a.label}
          </AdminButton>
        ))}
      </div>
    </article>
  );
}
