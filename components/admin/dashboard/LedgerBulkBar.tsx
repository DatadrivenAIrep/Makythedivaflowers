"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";
import { resolveLine } from "./product-lookup";
import {
  bulkRequest,
  ordersCsv,
  planBulk,
  type BulkAction,
  type BulkPayMethod,
  type BulkStatus,
  type SkipReason,
} from "@/lib/ledger-bulk";
import type { Order } from "@/types/order";

const STATUSES: BulkStatus[] = ["preparing", "out-for-delivery", "delivered"];
const METHODS: BulkPayMethod[] = ["cash", "zelle", "card-terminal", "ach"];
// Customers get a text when an order goes out or arrives, same as one by one.
const TEXTS_CUSTOMER: BulkStatus[] = ["out-for-delivery", "delivered"];

const label = (o: Order) => `#${o.orderNumber ?? o.id.slice(-6)}`;

/** Sticky bar over the Libro de órdenes while orders are selected. */
export default function LedgerBulkBar({
  selected,
  locale,
  onDone,
  onClear,
}: {
  selected: Order[];
  locale: "en" | "es";
  onDone: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("admin_ledger");
  const to = useTranslations("admin_orders");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const reasonText = (r: SkipReason) => t(`bulk_skip.${r}`);
  const skippedLine = (skipped: { order: Order; reason: SkipReason }[]) =>
    skipped.length === 0
      ? ""
      : "\n\n" + t("bulk_skipped", {
          count: skipped.length,
          list: skipped.slice(0, 6).map((s) => `${label(s.order)} (${reasonText(s.reason)})`).join(", ") +
            (skipped.length > 6 ? "…" : ""),
        });

  async function run(action: BulkAction) {
    const plan = planBulk(selected, action);
    if (plan.run.length === 0) {
      window.alert(t("bulk_nothing") + skippedLine(plan.skipped));
      return;
    }
    const question =
      action.kind === "status"
        ? t("bulk_confirm_status", { count: plan.run.length, status: to(`fulfillment_status.${action.status}`) }) +
          (TEXTS_CUSTOMER.includes(action.status) ? "\n" + t("bulk_confirm_sms") : "")
        : action.kind === "paid"
          ? t("bulk_confirm_paid", { count: plan.run.length, method: t(`bulk_method.${action.method}`) })
          : t("bulk_confirm_print", { count: plan.run.length });
    if (!window.confirm(question + skippedLine(plan.skipped))) return;

    setBusy(true);
    setResult(null);
    const failed: string[] = [];
    // One at a time, through the same endpoint the order drawer uses.
    for (const o of plan.run) {
      const { url, init } = bulkRequest(action, o.id);
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          failed.push(`${label(o)} (${body.error ?? res.status})`);
        }
      } catch {
        failed.push(`${label(o)} (${t("bulk_network")})`);
      }
    }
    setBusy(false);
    const done = plan.run.length - failed.length;
    setResult(
      t("bulk_result", { done }) +
        (failed.length ? ` · ${t("bulk_failed", { count: failed.length, list: failed.join(", ") })}` : "") +
        (plan.skipped.length ? ` · ${t("bulk_result_skipped", { count: plan.skipped.length })}` : ""),
    );
    onDone();
  }

  function exportCsv() {
    const csv = ordersCsv(selected, locale, (line) => {
      const r = resolveLine(line);
      return r.variantLabel ? `${r.name} (${r.variantLabel})` : r.name;
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${locale === "es" ? "ordenes" : "orders"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const select = "rounded-lg border border-ink/20 bg-bone px-2 py-1.5 text-sm disabled:opacity-50";

  return (
    <div
      role="region"
      aria-label={t("bulk_region")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-bone/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{t("bulk_selected", { count: selected.length })}</span>
        <select
          aria-label={t("bulk_status")}
          className={select}
          disabled={busy}
          value=""
          onChange={(e) => void run({ kind: "status", status: e.target.value as BulkStatus })}
        >
          <option value="" disabled>{t("bulk_status")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{to(`fulfillment_status.${s}`)}</option>)}
        </select>
        <select
          aria-label={t("bulk_paid")}
          className={select}
          disabled={busy}
          value=""
          onChange={(e) => void run({ kind: "paid", method: e.target.value as BulkPayMethod })}
        >
          <option value="" disabled>{t("bulk_paid")}</option>
          {METHODS.map((m) => <option key={m} value={m}>{t(`bulk_method.${m}`)}</option>)}
        </select>
        <AdminButton variant="secondary" disabled={busy} onClick={() => void run({ kind: "print" })}>
          {t("bulk_print")}
        </AdminButton>
        <AdminButton variant="secondary" disabled={busy} onClick={exportCsv}>
          {t("bulk_export")}
        </AdminButton>
        <button type="button" onClick={onClear} disabled={busy} className="ml-auto text-ink/60 underline disabled:opacity-50">
          {t("bulk_clear")}
        </button>
        {(busy || result) && (
          <p role="status" className="w-full text-xs text-ink/70">
            {busy ? t("bulk_working") : result}
          </p>
        )}
      </div>
    </div>
  );
}
