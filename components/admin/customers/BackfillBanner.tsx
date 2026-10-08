"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BackfillPreview, BackfillReport } from "@/lib/backfill-customers";

type RunResult = BackfillReport & { remaining: number };

type Props = {
  preview: BackfillPreview;
  /** Called after a successful run so the list can reload its totals. */
  onLinked: () => void;
};

/**
 * Shown only while paid orders are still unlinked to a customer. One click (plus a
 * confirm) links them via POST /api/admin/customers/backfill — which sends nothing.
 */
export default function BackfillBanner({ preview, onLinked }: Props) {
  const t = useTranslations("admin_customers");
  const [step, setStep] = useState<"idle" | "confirm" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<RunResult | null>(null);

  if (preview.pendingOrders <= 0 && step !== "done") return null;

  async function run() {
    setStep("running");
    try {
      const res = await fetch("/api/admin/customers/backfill", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as RunResult);
      setStep("done");
      onLinked();
    } catch {
      setStep("error");
    }
  }

  if (step === "done" && result) {
    return (
      <div role="status" className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
        <p>
          {t("backfill_done", {
            orders: result.customersCreated + result.ordersMerged,
            customers: result.customersCreated,
          })}
        </p>
        {result.failures.length > 0 && (
          <p className="mt-1 text-rose-800">{t("backfill_failures", { count: result.failures.length })}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded border border-ink/10 bg-bone p-3 text-sm">
      {step === "confirm" || step === "running" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto">
            {t("backfill_confirm", { customers: preview.newCustomers, orders: preview.pendingOrders })}
          </p>
          <button
            type="button"
            onClick={() => setStep("idle")}
            disabled={step === "running"}
            className="min-h-11 rounded-lg border border-ink/20 px-3 hover:bg-ink/5 disabled:opacity-50"
          >
            {t("backfill_cancel")}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={step === "running"}
            className="min-h-11 rounded-lg bg-rouge px-3 text-bone disabled:opacity-50"
          >
            {step === "running" ? t("backfill_running") : t("backfill_confirm_go")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-ink/70">{t("backfill_banner", { count: preview.pendingOrders })}</p>
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="min-h-11 rounded-lg border border-ink/20 px-3 hover:bg-ink/5"
          >
            {t("backfill_cta")}
          </button>
        </div>
      )}
      {step === "error" && <p className="mt-2 text-rose-800">{t("backfill_error")}</p>}
    </div>
  );
}
