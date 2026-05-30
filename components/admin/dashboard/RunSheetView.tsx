"use client";
import { useCallback, useEffect, useState } from "react";
import { Truck, CheckCircle, Phone, NoteBlank } from "@phosphor-icons/react/dist/ssr";
import DashboardShell from "./DashboardShell";
import OrderDetailDrawer from "./OrderDetailDrawer";
import AdminButton from "./AdminButton";
import { resolveLine } from "./product-lookup";
import type { Order } from "@/types/order";

type RunSheetResp = { date: string; orders: Order[] };

const SLOT_ORDER = ["morning", "midday", "afternoon", "evening"] as const;
type Slot = (typeof SLOT_ORDER)[number];
const SLOT_LABEL: Record<Slot, string> = {
  morning: "Mañana", midday: "Mediodía", afternoon: "Tarde", evening: "Noche",
};
const FUL_LABEL: Record<string, string> = {
  pending: "Pendiente", preparing: "Preparando",
  "out-for-delivery": "En camino", delivered: "Entregada",
};

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

function itemsLine(o: Order): string {
  if (o.lines.length === 0) return "—";
  return o.lines.map((l) => {
    const r = resolveLine(l);
    const v = r.variantLabel ? ` (${r.variantLabel})` : "";
    return `${r.name}${v} ×${r.qty}`;
  }).join(", ");
}

function addonsLine(o: Order): string[] {
  return o.lines.flatMap((l) => resolveLine(l).addOnLabels);
}

export default function RunSheetView({ locale }: { locale: string }) {
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  const fetchSheet = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/run-sheet?date=${d}`, { cache: "no-store" });
      const body = (await res.json()) as RunSheetResp;
      setOrders(body.orders);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchSheet(date); }, [date, fetchSheet]);

  async function advance(orderId: string, status: "out-for-delivery" | "delivered") {
    await fetch(`/api/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchSheet(date);
  }

  const grouped = SLOT_ORDER.map((slot) => ({
    slot,
    orders: orders.filter((o) => o.fulfillment.method === "delivery" && o.fulfillment.window.slot === slot),
  })).filter((g) => g.orders.length > 0);

  const delivered = orders.filter((o) => o.status === "delivered").length;

  return (
    <DashboardShell locale={locale}>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-ink/15 bg-bone px-2 py-1 text-sm"
        />
        <AdminButton variant="secondary" onClick={() => setDate(todayISO())}>Hoy</AdminButton>
        <span className="ml-auto text-sm text-ink/60">
          {orders.length} entregas · {delivered} completadas
        </span>
      </div>

      {loading && orders.length === 0 && <p className="text-sm text-ink/50">Cargando…</p>}
      {!loading && orders.length === 0 && (
        <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">Sin entregas para esta fecha.</p>
      )}

      {grouped.map((group) => (
        <section key={group.slot} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {SLOT_LABEL[group.slot]} · {group.orders.length}
          </h2>
          <ul className="space-y-2">
            {group.orders.map((o) => {
              if (o.fulfillment.method !== "delivery") return null;
              const f = o.fulfillment;
              const addrLink = `https://maps.google.com/?q=${encodeURIComponent(`${f.address.street1}, ${f.address.city}, ${f.address.state} ${f.address.zip}`)}`;
              const addons = addonsLine(o);
              const done = o.status === "delivered";
              return (
                <li key={o.id} className={`rounded-lg border border-ink/10 bg-bone p-3 text-sm shadow-sm ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => setDrawerOrderId(o.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{f.recipient.name}</span>
                        <span className="text-xs text-ink/40">#{o.id.slice(-6)}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${o.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {o.paymentStatus === "paid" ? "Pagado" : "Cobrar"}
                        </span>
                        <span className="ml-auto text-xs text-ink/60">{FUL_LABEL[o.status] ?? o.status} · {money(o.totals.totalCents)}</span>
                      </div>
                      <div className="mt-1">
                        <a href={addrLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-ink/80 underline">
                          {f.address.street1}, {f.address.city} {f.address.zip}
                        </a>
                      </div>
                      <div className="mt-0.5 text-xs text-ink/60">{itemsLine(o)}</div>
                      {addons.length > 0 && <div className="text-xs text-emerald-700">+ {addons.join(", ")}</div>}
                      {f.cardMessage && (
                        <div className="mt-1 flex items-start gap-1.5 rounded bg-ink/5 p-1.5 text-xs italic">
                          <NoteBlank size={14} weight="bold" className="mt-0.5 flex-shrink-0" />
                          <span>&quot;{f.cardMessage}&quot;</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-ink/5 pt-2">
                    <AdminButton variant="secondary" icon={Phone} href={`tel:${f.recipient.phone}`} onClick={(e) => e.stopPropagation()}>{f.recipient.phone}</AdminButton>
                    {o.status !== "delivered" && o.status !== "out-for-delivery" && (
                      <AdminButton variant="secondary" icon={Truck} onClick={() => advance(o.id, "out-for-delivery")}>En camino</AdminButton>
                    )}
                    {o.status !== "delivered" && (
                      <AdminButton variant="primary" icon={CheckCircle} onClick={() => advance(o.id, "delivered")}>Entregada</AdminButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {drawerOrderId && (
        <OrderDetailDrawer
          orderId={drawerOrderId}
          onClose={() => setDrawerOrderId(null)}
          onChanged={() => { void fetchSheet(date); }}
        />
      )}
    </DashboardShell>
  );
}
