"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardShell from "./DashboardShell";
import OrderDetailDrawer from "./OrderDetailDrawer";
import AdminButton from "./AdminButton";
import RunSheetList, { type RunSheetViewMode } from "./RunSheetList";
import type { Order } from "@/types/order";

type RunSheetResp = { date: string; orders: Order[] };

export const RUN_SHEET_VIEW_KEY = "diva_run_sheet_view";

function readStoredView(): RunSheetViewMode {
  try {
    return localStorage.getItem(RUN_SHEET_VIEW_KEY) === "zone" ? "zone" : "time";
  } catch {
    return "time";
  }
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export default function RunSheetView({ locale }: { locale: string }) {
  const t = useTranslations("admin_dashboard");
  const [date, setDate] = useState(todayISO());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  // Starts at "time" on the server and first render (no hydration mismatch),
  // then picks up the remembered choice.
  const [view, setView] = useState<RunSheetViewMode>("time");

  useEffect(() => { setView(readStoredView()); }, []);

  function chooseView(next: RunSheetViewMode) {
    setView(next);
    try { localStorage.setItem(RUN_SHEET_VIEW_KEY, next); } catch { /* private mode / blocked storage */ }
  }

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

  const delivered = orders.filter((o) => o.status === "delivered").length;

  return (
    <DashboardShell locale={locale}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-ink/15 bg-bone px-2 py-1 text-sm"
        />
        <AdminButton variant="secondary" onClick={() => setDate(todayISO())}>{t("today_button")}</AdminButton>
        <div role="group" aria-label={t("view_toggle_label")} className="inline-flex p-1 bg-mute-100 rounded-full gap-0.5">
          {([["time", t("view_by_time")], ["zone", t("view_by_zone")]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => chooseView(id)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                view === id ? "bg-white text-ink font-medium shadow-sm" : "text-mute-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-ink/60">
          {orders.length} {t("deliveries_count")} · {delivered} {t("completed_count")}
        </span>
      </div>

      {loading && orders.length === 0 && <p className="text-sm text-ink/50">{t("loading")}</p>}
      {!loading && orders.length === 0 && (
        <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">{t("no_deliveries")}</p>
      )}

      <RunSheetList orders={orders} locale={locale} view={view} onOpen={setDrawerOrderId} onAdvance={advance} />

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
