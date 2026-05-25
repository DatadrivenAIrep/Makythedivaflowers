"use client";
import { useEffect, useState } from "react";
import type { Order } from "@/types/order";

type Message = {
  id: string; channel: string; template: string; locale: string;
  to_phone?: string | null; to_email?: string | null;
  status: string; created_at: string;
};
type DetailResp = {
  order: Order;
  customer: { id: string; name: string; phone: string; email?: string | null } | null;
  messages: Message[];
};

type Props = {
  orderId: string;
  onClose: () => void;
  onChanged: () => void; // parent refreshes lists
};

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function fmtTs(ts: string) { return new Date(ts).toLocaleString("es-US"); }

const FULFILLMENT_STEPS: { id: string; label: string }[] = [
  { id: "pending", label: "Recibida" },
  { id: "preparing", label: "Preparando" },
  { id: "out-for-delivery", label: "En camino" },
  { id: "delivered", label: "Entregada" },
];

export default function OrderDetailDrawer({ orderId, onClose, onChanged }: Props) {
  const [data, setData] = useState<DetailResp | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

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

  if (!data) {
    return (
      <div className="fixed inset-0 z-20 flex" onClick={onClose}>
        <div className="ml-auto h-full w-full max-w-xl animate-pulse bg-bone p-4 shadow-xl text-sm text-ink/40">
          Cargando…
        </div>
      </div>
    );
  }

  const { order, customer, messages } = data;
  const f = order.fulfillment;
  const addrLink = f.method === "delivery"
    ? `https://maps.google.com/?q=${encodeURIComponent(`${f.address.street1}, ${f.address.city}, ${f.address.state} ${f.address.zip}`)}`
    : null;
  const currentStepIdx = FULFILLMENT_STEPS.findIndex((s) => s.id === order.status);

  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-bone p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{f.recipient.name} · #{order.id.slice(-6)}</h2>
          <button onClick={onClose} className="rounded border border-ink/20 px-2 py-1 text-xs">Cerrar</button>
        </header>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="font-semibold">{customer?.name ?? f.recipient.name}</div>
          <div className="text-ink/70">
            <a href={`tel:${order.contact.phone}`} className="underline">{order.contact.phone}</a>
            {order.contact.email && <> · <a href={`mailto:${order.contact.email}`} className="underline">{order.contact.email}</a></>}
            {customer && " · cliente recurrente"}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">Entrega</div>
          <div>{f.method === "delivery" ? "Delivery" : f.method === "pickup" ? "Pickup" : "En tienda"}
            {f.method !== "in-store" && <> · {f.window.date} · {f.window.slot}</>}
          </div>
          {addrLink && (
            <div className="mt-1">
              <a href={addrLink} target="_blank" rel="noreferrer" className="underline">
                {f.address.street1}, {f.address.city}, {f.address.state} {f.address.zip}
              </a>
            </div>
          )}
          {f.cardMessage && (
            <div className="mt-2 rounded bg-ink/5 p-2 text-xs italic">&quot;{f.cardMessage}&quot;</div>
          )}
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">Totales</div>
          <div className="grid grid-cols-2 gap-y-0.5">
            <span>Subtotal</span><span className="text-right">{money(order.totals.subtotalCents)}</span>
            <span>Delivery</span><span className="text-right">{money(order.totals.deliveryCents)}</span>
            <span>Tax</span><span className="text-right">{money(order.totals.taxCents)}</span>
            <span className="font-semibold">Total</span><span className="text-right font-semibold">{money(order.totals.totalCents)}</span>
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Estado</div>
          <ol className="space-y-1">
            {FULFILLMENT_STEPS.map((s, i) => (
              <li key={s.id} className={i <= currentStepIdx ? "text-ink" : "text-ink/30"}>
                {i <= currentStepIdx ? "●" : "○"} {s.label}
              </li>
            ))}
          </ol>
          <div className="mt-2 text-xs text-ink/60">
            Pago: {order.paymentStatus === "paid" ? `Pagado (${order.paymentMethod ?? "?"})` : "Pendiente"}
            {order.paidAt && ` · ${fmtTs(order.paidAt)}`}
          </div>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Mensajes ({messages.length})</div>
          {messages.length === 0 && <div className="text-ink/50">Ninguno todavía.</div>}
          <ul className="space-y-1">
            {messages.map((m) => (
              <li key={m.id} className="text-xs">
                <span className="text-ink/60">{fmtTs(m.created_at)}</span>{" "}
                <span className="font-semibold uppercase">{m.channel}</span>{" "}
                {m.template} · {m.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">Notas internas</div>
          {order.internalNotes && (
            <pre className="mb-2 whitespace-pre-wrap text-xs text-ink/70">{order.internalNotes}</pre>
          )}
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Añadir nota…"
              className="flex-1 rounded border border-ink/15 px-2 py-1 text-sm"
            />
            <button
              disabled={busy || !noteDraft.trim()}
              onClick={async () => {
                await call("POST", `/api/admin/orders/${order.id}/notes`, { text: noteDraft });
                setNoteDraft("");
              }}
              className="rounded border border-ink/20 px-3 py-1 text-xs disabled:opacity-40"
            >Agregar</button>
          </div>
        </section>

        <footer className="sticky bottom-0 -mx-4 -mb-4 border-t border-ink/10 bg-bone p-3">
          <div className="flex flex-wrap gap-2">
            {order.paymentStatus !== "paid" && (
              <>
                <button disabled={busy} onClick={() => call("POST", `/api/admin/orders/${order.id}/resend`, { kind: "payment_link" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">↻ Reenviar link</button>
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "cash" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Cash</button>
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/payment`, { method: "zelle" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Zelle</button>
              </>
            )}
            {order.paymentStatus === "paid" && order.status !== "delivered" && (
              <>
                {order.status === "pending" && (
                  <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "preparing" })}
                    className="rounded border border-ink/20 px-3 py-1 text-xs">📦 Preparar</button>
                )}
                {order.status !== "out-for-delivery" && (
                  <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "out-for-delivery" })}
                    className="rounded border border-ink/20 px-3 py-1 text-xs">🚚 En camino</button>
                )}
                <button disabled={busy} onClick={() => call("PATCH", `/api/admin/orders/${order.id}/fulfillment`, { status: "delivered" })}
                  className="rounded border border-ink/20 px-3 py-1 text-xs">✓ Entregada</button>
              </>
            )}
            <a href={`https://wa.me/${order.contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="rounded border border-ink/20 px-3 py-1 text-xs">📞 WhatsApp</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
