"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  WhatsappLogo, ArrowsClockwise, Check, CheckCircle,
  Package, Truck, XCircle, X, Pencil, Eye, Printer,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations, useLocale } from "next-intl";
import { formatDateTime } from "@/lib/format-datetime";
import { resolveLine } from "./product-lookup";
import AdminButton from "./AdminButton";
import OrderEditForm from "./OrderEditForm";
import OrderHistoryList from "./OrderHistoryList";
import type { Order, OrderChange } from "@/types/order";
import type { OrderEditPatch } from "@/lib/order-edit";

type Message = {
  id: string; channel: string; template: string; locale: string;
  to_phone?: string | null; to_email?: string | null;
  status: string; created_at: string;
};
type DetailResp = {
  order: Order;
  customer: { id: string; name: string; phone: string; email?: string | null } | null;
  messages: Message[];
  history?: OrderChange[];
  balanceCents?: number;
};

type Props = {
  orderId: string;
  onClose: () => void;
  onChanged: () => void; // parent refreshes lists
};

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

const FULFILLMENT_STEP_IDS = ["pending", "preparing", "out-for-delivery", "delivered"] as const;

export default function OrderDetailDrawer({ orderId, onClose, onChanged }: Props) {
  const t = useTranslations("admin_orders");
  const locale = useLocale();
  const [data, setData] = useState<DetailResp | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundChecked, setRefundChecked] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      const body = (await res.json()) as DetailResp;
      if (!cancelled) setData(body);
      if (!cancelled && body.order.source === "web") {
        void fetch(`/api/admin/orders/${orderId}/ack`, { method: "POST" });
      }
    })();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => { cancelled = true; document.removeEventListener("keydown", onKey); };
  }, [orderId, onClose]);

  async function call(method: string, url: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method, headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
        setData((await refreshed.json()) as DetailResp);
        onChanged();
      }
    } finally { setBusy(false); }
  }

  async function saveEdit(patch: OrderEditPatch) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
        setData((await refreshed.json()) as DetailResp);
        onChanged();
        setEditing(false);
      }
    } finally { setBusy(false); }
  }

  async function reprint() {
    if (!window.confirm(t("reprint_confirm"))) return;
    await call("POST", `/api/admin/orders/${orderId}/reprint`);
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-20 flex" onClick={onClose}>
        <div className="ml-auto h-full w-full max-w-xl animate-pulse bg-bone p-4 shadow-xl text-sm text-ink/40">
          {t("loading")}
        </div>
      </div>
    );
  }

  const { order, customer, messages } = data;
  const f = order.fulfillment;
  const addrLink = f.method === "delivery"
    ? `https://maps.google.com/?q=${encodeURIComponent(`${f.address.street1}, ${f.address.city}, ${f.address.state} ${f.address.zip}`)}`
    : null;
  const currentStepIdx = FULFILLMENT_STEP_IDS.findIndex((id) => id === order.status);

  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{f.recipient.name} · #{order.id.slice(-6)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {!editing && (
              <>
                <AdminButton variant="secondary" icon={Pencil} disabled={busy} onClick={() => setEditing(true)}>{t("edit")}</AdminButton>
                <AdminButton variant="secondary" icon={Eye} href={`/api/admin/orders/${order.id}/sheet`} target="_blank" rel="noreferrer">{t("preview")}</AdminButton>
                <AdminButton variant="secondary" icon={Printer} disabled={busy} onClick={reprint}>{t("reprint")}</AdminButton>
              </>
            )}
            <AdminButton variant="secondary" icon={X} onClick={onClose} aria-label={t("close")}>{t("close")}</AdminButton>
          </div>
        </header>

        {!editing && (order.amountPaidCents ?? 0) > 0 && (data.balanceCents ?? 0) !== 0 && (
          <div className={`mb-3 flex items-center justify-between gap-2 rounded px-3 py-2 text-sm font-semibold ${
            (data.balanceCents ?? 0) > 0 ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"
          }`}>
            <span>{(data.balanceCents ?? 0) > 0 ? t("balance_due") : t("balance_credit")}: {money(Math.abs(data.balanceCents ?? 0))}</span>
            <AdminButton variant="secondary" disabled={busy}
              onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { settleBalance: true })}>
              {t("mark_settled")}
            </AdminButton>
          </div>
        )}

        {editing && (
          <OrderEditForm order={order} busy={busy} onCancel={() => setEditing(false)} onSave={saveEdit} />
        )}

        {!editing && (<>
        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="font-semibold">{customer?.name ?? f.recipient.name}</div>
          <div className="text-ink/70">
            <a href={`tel:${order.contact.phone}`} className="underline">{order.contact.phone}</a>
            {order.contact.email && <> · <a href={`mailto:${order.contact.email}`} className="underline">{order.contact.email}</a></>}
            {customer && ` · ${t("returning_customer")}`}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("delivery_section")}</div>
          <div>{f.method === "delivery" ? t("method_delivery") : f.method === "pickup" ? t("method_pickup") : t("method_in_store")}
            {f.method !== "in-store" && <> · {f.window.date} · {t("slot." + f.window.slot)}</>}
          </div>
          {f.method === "delivery" && addrLink && (
            <div className="mt-1">
              <a href={addrLink} target="_blank" rel="noreferrer" className="underline">
                {f.address.street1}, {f.address.city}, {f.address.state} {f.address.zip}
              </a>
            </div>
          )}
          {f.recipient.phone && (
            <div className="mt-1 text-xs text-ink/60">
              {t("recipient_phone")}: <a href={`tel:${f.recipient.phone}`} className="underline">{f.recipient.phone}</a>
            </div>
          )}
          {f.cardMessage && (
            <div className="mt-2 rounded bg-ink/5 p-2 text-xs italic">&quot;{f.cardMessage}&quot;</div>
          )}
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("items", { count: order.lines.length })}</div>
          {order.lines.length === 0 && <div className="text-ink/50">{t("no_items")}</div>}
          <ul className="space-y-2">
            {order.lines.map((l, i) => {
              const r = resolveLine(l);
              return (
                <li key={i} className="flex items-start gap-3">
                  {r.thumb ? (
                    <Image src={r.thumb} alt={r.name} width={48} height={60} className="rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-[60px] w-[48px] flex-shrink-0 rounded bg-ink/5" />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{r.name} × {r.qty}</span>
                      {r.customPriceCents !== null && (
                        <span className="text-ink/60">{money(r.customPriceCents * r.qty)}</span>
                      )}
                    </div>
                    <div className="text-xs text-ink/50">
                      {r.variantLabel}{r.productId && ` · ${r.productId}`}
                    </div>
                    {r.addOnLabels.length > 0 && (
                      <div className="mt-0.5 text-xs text-emerald-700">+ {r.addOnLabels.join(", ")}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("totals")}</div>
          <div className="grid grid-cols-2 gap-y-0.5">
            <span>{t("subtotal")}</span><span className="text-right">{money(order.totals.subtotalCents)}</span>
            <span>{t("delivery")}</span><span className="text-right">{money(order.totals.deliveryCents)}</span>
            <span>{t("tax")}</span><span className="text-right">{money(order.totals.taxCents)}</span>
            <span className="font-semibold">{t("total")}</span><span className="text-right font-semibold">{money(order.totals.totalCents)}</span>
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("status")}</div>
          {order.status === "canceled" ? (
            <div className="flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
              <XCircle size={16} weight="fill" /> {t("order_canceled")}
            </div>
          ) : (
            <ol className="space-y-1">
              {FULFILLMENT_STEP_IDS.map((id, i) => (
                <li key={id} className={i <= currentStepIdx ? "text-ink" : "text-ink/30"}>
                  {i <= currentStepIdx ? "●" : "○"} {t("fulfillment_status." + id)}
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2 text-xs text-ink/60">
            {t("payment_label")}: {order.paymentStatus === "paid" ? t("paid_with", { method: order.paymentMethod ?? "?" })
              : order.paymentStatus === "refunded" ? t("payment_status.refunded") : t("payment_status.pending")}
            {order.paidAt && order.paymentStatus !== "refunded" && ` · ${formatDateTime(order.paidAt, locale)}`}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("messages", { count: messages.length })}</div>
          {messages.length === 0 && <div className="text-ink/50">{t("none_yet")}</div>}
          <ul className="space-y-1">
            {messages.map((m) => (
              <li key={m.id} className="text-xs">
                <span className="text-ink/60">{formatDateTime(m.created_at, locale)}</span>{" "}
                <span className="font-semibold uppercase">{m.channel}</span>{" "}
                {m.template} · {m.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("internal_notes")}</div>
          {order.internalNotes && (
            <pre className="mb-2 whitespace-pre-wrap text-xs text-ink/70">{order.internalNotes}</pre>
          )}
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t("add_note_placeholder")}
              className="flex-1 rounded border border-ink/15 px-2 py-1 text-sm"
            />
            <AdminButton
              variant="secondary"
              disabled={busy || !noteDraft.trim()}
              onClick={async () => {
                await call("POST", `/api/admin/orders/${order.id}/notes`, { text: noteDraft });
                setNoteDraft("");
              }}
            >{t("add")}</AdminButton>
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("history")}</div>
          <OrderHistoryList history={data.history ?? []} />
        </section>

        <footer className="sticky bottom-0 -mx-4 -mb-4 border-t border-ink/10 bg-bone p-3">
          <div className="flex flex-wrap gap-2">
            {order.paymentStatus !== "paid" && (
              <>
                <AdminButton variant="secondary" icon={ArrowsClockwise} disabled={busy}
                  onClick={() => call("POST", `/api/admin/orders/${order.id}/resend`, { kind: "payment_link" })}>{t("resend_link")}</AdminButton>
                <AdminButton variant="primary" icon={Check} disabled={busy}
                  onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "cash" })}>{t("cash")}</AdminButton>
                <AdminButton variant="primary" icon={Check} disabled={busy}
                  onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "zelle" })}>{t("zelle")}</AdminButton>
              </>
            )}
            {order.status !== "delivered" && order.status !== "canceled" && (
              <>
                {order.status === "pending" && (
                  <AdminButton variant="secondary" icon={Package} disabled={busy}
                    onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "preparing" })}>{t("prepare")}</AdminButton>
                )}
                {order.status !== "out-for-delivery" && (
                  <AdminButton variant="secondary" icon={Truck} disabled={busy}
                    onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "out-for-delivery" })}>{t("out_for_delivery")}</AdminButton>
                )}
                <AdminButton variant="primary" icon={CheckCircle} disabled={busy}
                  onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "delivered" })}>{t("delivered")}</AdminButton>
              </>
            )}
            <AdminButton variant="secondary" icon={WhatsappLogo}
              href={`https://wa.me/${order.contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{t("whatsapp")}</AdminButton>
            {order.status !== "delivered" && order.status !== "canceled" && !cancelOpen && (
              <AdminButton variant="danger" icon={XCircle} disabled={busy}
                className="ml-auto" onClick={() => setCancelOpen(true)}>{t("cancel_order")}</AdminButton>
            )}
          </div>
          {cancelOpen && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 p-3 text-xs">
              <div className="mb-2 font-semibold text-red-700">{t("cancel_this_order")}</div>
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("cancel_reason_placeholder")}
                className="mb-2 w-full rounded border border-red-200 bg-bone px-2 py-1"
              />
              {order.paymentStatus === "paid" && (
                <label className="mb-2 flex items-center gap-2 text-red-700">
                  <input type="checkbox" checked={refundChecked} onChange={(e) => setRefundChecked(e.target.checked)} />
                  {t("mark_refunded")}
                </label>
              )}
              <div className="flex gap-2">
                <AdminButton
                  variant="dangerSolid"
                  disabled={busy}
                  onClick={async () => {
                    await call("PATCH", `/api/admin/orders/${order.id}/cancel`, {
                      refund: order.paymentStatus === "paid" ? refundChecked : false,
                      reason: cancelReason.trim() || undefined,
                    });
                    setCancelOpen(false); setCancelReason(""); setRefundChecked(false);
                  }}
                >{t("confirm_cancel")}</AdminButton>
                <AdminButton variant="secondary" disabled={busy} onClick={() => setCancelOpen(false)}>{t("back")}</AdminButton>
              </div>
            </div>
          )}
        </footer>
        </>)}
      </div>
    </div>
  );
}
