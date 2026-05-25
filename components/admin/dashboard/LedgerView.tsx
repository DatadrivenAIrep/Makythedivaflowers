"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "./DashboardShell";
import LedgerFilters, { type LedgerFilterValue } from "./LedgerFilters";
import OrderDetailDrawer from "./OrderDetailDrawer";
import type { Order } from "@/types/order";

type ListResp = { orders: Order[]; nextCursor: string | null; approxTotal: number };

function paramsToValue(sp: URLSearchParams): LedgerFilterValue {
  const list = (k: string) => {
    const arr = sp.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
    return arr.length ? arr : undefined;
  };
  return {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    paymentStatus: list("paymentStatus"),
    fulfillmentStatus: list("fulfillmentStatus"),
    source: list("source"),
    fulfillmentMethod: list("fulfillmentMethod"),
  };
}

function valueToParams(v: LedgerFilterValue): URLSearchParams {
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.from) sp.set("from", v.from);
  if (v.to) sp.set("to", v.to);
  for (const k of ["paymentStatus", "fulfillmentStatus", "source", "fulfillmentMethod"] as const) {
    for (const item of v[k] ?? []) sp.append(k, item);
  }
  return sp;
}

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
function dateStr(s: string) { return new Date(s).toLocaleDateString("es-US"); }

const PAY_BADGE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-stone-200 text-stone-700",
};
const FUL_LABEL: Record<string, string> = {
  pending: "Pendiente", preparing: "Preparando",
  "out-for-delivery": "En camino", delivered: "Entregada",
  failed: "Fallida", canceled: "Cancelada",
};

function LedgerRow({ order, onOpen }: { order: Order; onOpen: (id: string) => void }) {
  return (
    <li
      onClick={() => onOpen(order.id)}
      className="cursor-pointer rounded border border-ink/10 bg-bone p-3 text-sm hover:bg-ink/5"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink/50 uppercase">{order.source}</span>
        <span className="font-semibold">{order.fulfillment.recipient.name}</span>
        <span className="text-xs text-ink/40">#{order.id.slice(-6)}</span>
        <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink/60">
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${PAY_BADGE[order.paymentStatus] ?? ""}`}>
          {order.paymentStatus === "paid" ? "Pagado" : order.paymentStatus === "pending" ? "Pendiente" : "Reembolsado"}
        </span>
        <span>· {FUL_LABEL[order.status] ?? order.status}</span>
        <span>· {dateStr(order.createdAt)}</span>
      </div>
    </li>
  );
}

export default function LedgerView({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = useMemo(() => paramsToValue(searchParams), [searchParams]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [approxTotal, setApproxTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  const fetchPage = useCallback(async (cursor: string | null) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams(queryKey);
      sp.set("limit", "50");
      if (cursor) sp.set("cursor", cursor);
      const res = await fetch(`/api/admin/orders?${sp.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as ListResp;
      setOrders((prev) => cursor ? [...prev, ...body.orders] : body.orders);
      setNextCursor(body.nextCursor);
      setApproxTotal(body.approxTotal);
    } finally { setLoading(false); }
  }, [queryKey]);

  useEffect(() => { void fetchPage(null); }, [fetchPage]);

  function onChange(next: LedgerFilterValue) {
    const sp = valueToParams(next);
    router.replace(`/${locale}/admin/dashboard/ledger?${sp.toString()}`);
  }

  return (
    <DashboardShell locale={locale}>
      <section className="mb-4">
        <LedgerFilters value={value} onChange={onChange} />
      </section>
      <section>
        {orders.length === 0 && !loading ? (
          <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">
            Sin órdenes que coincidan.{" "}
            <button onClick={() => onChange({})} className="underline">Limpiar filtros</button>
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <LedgerRow key={o.id} order={o} onOpen={setDrawerOrderId} />
            ))}
          </ul>
        )}
        <footer className="mt-4 text-center text-xs text-ink/60">
          Mostrando {orders.length} de ~{approxTotal}
          {nextCursor && (
            <button
              onClick={() => fetchPage(nextCursor)}
              disabled={loading}
              className="ml-3 rounded border border-ink/20 px-3 py-1 text-xs disabled:opacity-50"
            >Cargar 50 más</button>
          )}
        </footer>
      </section>

      {drawerOrderId && (
        <OrderDetailDrawer
          orderId={drawerOrderId}
          onClose={() => setDrawerOrderId(null)}
          onChanged={() => { void fetchPage(null); }}
        />
      )}
    </DashboardShell>
  );
}
