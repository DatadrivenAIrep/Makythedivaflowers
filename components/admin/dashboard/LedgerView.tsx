"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import DashboardShell from "./DashboardShell";
import LedgerFilters, { type LedgerFilterValue } from "./LedgerFilters";
import OrderDetailDrawer from "./OrderDetailDrawer";
import { resolveLine } from "./product-lookup";
import AdminButton from "./AdminButton";
import LedgerBulkBar from "./LedgerBulkBar";
import { formatDate } from "@/lib/format-datetime";
import type { Order } from "@/types/order";

type Translator = (key: string) => string;

function ledgerItemSummary(order: Order, t: Translator): string {
  if (order.lines.length === 0) return "—";
  const first = resolveLine(order.lines[0]);
  const variantLabel = first.variantLabel ? ` · ${first.variantLabel}` : "";
  const suffix = order.lines.length > 1 ? ` + ${order.lines.length - 1} ${t("more")}` : "";
  return first.name + variantLabel + suffix;
}

type ListResp = { orders: Order[]; nextCursor: string | null; approxTotal: number; hiddenCount: number };

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
    showHidden: sp.get("showHidden") === "1" ? true : undefined,
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
  if (v.showHidden) sp.set("showHidden", "1");
  return sp;
}

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

const PAY_BADGE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-stone-200 text-stone-700",
};

function LedgerRow({ order, onOpen, t, to, locale, selected, onToggle }: {
  order: Order;
  onOpen: (id: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  to: Translator;
  locale: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li
      onClick={() => onOpen(order.id)}
      className={`cursor-pointer rounded-lg border bg-bone p-3 text-sm shadow-sm transition-shadow hover:shadow-md ${selected ? "border-ink/40 ring-1 ring-ink/20" : "border-ink/10"}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          // Ticking the box selects; it must not also open the order.
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(order.id)}
          aria-label={t("bulk_select_one", { order: `#${order.orderNumber ?? order.id.slice(-6)}` })}
          className="h-4 w-4 accent-ink"
        />
        <span className="text-xs text-ink/50 uppercase">{order.source}</span>
        <span className="font-semibold">{order.fulfillment.recipient.name}</span>
        <span className="text-xs text-ink/40">#{order.id.slice(-6)}</span>
        <span className="ml-auto font-semibold">{money(order.totals.totalCents)}</span>
      </div>
      <div className="mt-0.5 text-xs text-ink/60">{ledgerItemSummary(order, t)}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-ink/60">
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${PAY_BADGE[order.paymentStatus] ?? ""}`}>
          {order.paymentStatus === "pending" && (order.amountPaidCents ?? 0) > 0
            ? to("payment_status_deposit")
            : to(`payment_status.${order.paymentStatus}`)}
        </span>
        <span>· {to(`fulfillment_status.${order.status}`)}</span>
        <span>· {formatDate(order.createdAt, locale)}</span>
      </div>
    </li>
  );
}

export default function LedgerView({ locale }: { locale: string }) {
  const t = useTranslations("admin_ledger");
  const to = useTranslations("admin_orders");
  const activeLocale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = useMemo(() => paramsToValue(searchParams), [searchParams]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [approxTotal, setApproxTotal] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const queryKey = searchParams.toString();
  // A new search is a new list: start the selection over.
  useEffect(() => { setSelectedIds(new Set()); }, [queryKey]);

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const allShownSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setSelectedIds(allShownSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }

  const fetchPage = useCallback(async (cursor: string | null) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams(queryKey);
      // "showHidden" is a view preference, not a query the API knows about: it
      // simply turns the noise filter off.
      const showHidden = sp.get("showHidden") === "1";
      sp.delete("showHidden");
      if (!showHidden) sp.set("hideInactive", "1");
      sp.set("limit", "50");
      if (cursor) sp.set("cursor", cursor);
      const res = await fetch(`/api/admin/orders?${sp.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as ListResp;
      setOrders((prev) => cursor ? [...prev, ...body.orders] : body.orders);
      setNextCursor(body.nextCursor);
      setApproxTotal(body.approxTotal);
      setHiddenCount(body.hiddenCount ?? 0);
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
            {t("empty")}{" "}
            <button onClick={() => onChange({})} className="underline">{t("clear_filters")}</button>
          </p>
        ) : (
          <>
            <label className="mb-2 flex w-fit items-center gap-2 px-3 text-xs text-ink/60">
              <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="h-4 w-4 accent-ink" />
              {t("bulk_select_all", { count: orders.length })}
            </label>
            <ul className={`space-y-2 ${selectedOrders.length > 0 ? "pb-28" : ""}`}>
              {orders.map((o) => (
                <LedgerRow
                  key={o.id}
                  order={o}
                  onOpen={setDrawerOrderId}
                  t={t}
                  to={to}
                  locale={activeLocale}
                  selected={selectedIds.has(o.id)}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </>
        )}
        <footer className="mt-4 flex items-center justify-center gap-3 text-xs text-ink/60">
          <span>{t("showing", { shown: orders.length, total: approxTotal })}</span>
          {!value.showHidden && hiddenCount > 0 && (
            <button onClick={() => onChange({ ...value, showHidden: true })} className="underline">
              {t("hidden_count", { count: hiddenCount })}
            </button>
          )}
          {value.showHidden && (
            <button onClick={() => onChange({ ...value, showHidden: undefined })} className="underline">
              {t("hide_inactive")}
            </button>
          )}
          {nextCursor && (
            <AdminButton variant="secondary" onClick={() => fetchPage(nextCursor)} disabled={loading}>
              {t("load_more")}
            </AdminButton>
          )}
        </footer>
      </section>

      {selectedOrders.length > 0 && (
        <LedgerBulkBar
          selected={selectedOrders}
          locale={activeLocale === "es" ? "es" : "en"}
          onDone={() => { void fetchPage(null); }}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

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
