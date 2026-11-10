"use client";
import { useTranslations } from "next-intl";
import type { DateResults as Results } from "@/lib/date-results";

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

/** The 90-day readout of stamps-for-data. Numbers only; the note says not to over-read them. */
export default function DateResults({ results }: { results: Results }) {
  const t = useTranslations("admin_customers");
  const stages = ["d7", "d3"] as const;
  return (
    <section className="mx-auto mb-4 max-w-4xl rounded border border-ink/10 bg-bone p-3">
      <h2 className="mb-2 text-sm font-semibold">{t("results_title")}</h2>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat label={t("results_customers")} value={results.customersWithOwnDates} />
        <Stat label={t("results_with_sms")} value={results.withSms} />
        <Stat label={t("results_stops")} value={results.stopsWithin48h} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink/50">
            <th className="py-1 font-normal">{t("results_stage")}</th>
            <th className="py-1 text-right font-normal">{t("results_sent")}</th>
            <th className="py-1 text-right font-normal">{t("results_skipped")}</th>
            <th className="py-1 text-right font-normal">{t("results_orders")}</th>
            <th className="py-1 text-right font-normal">{t("results_revenue")}</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s} className="border-t border-ink/10">
              <td className="py-1">{t(`results_stage_${s}`)}</td>
              <td className="py-1 text-right">{results.stages[s].sent}</td>
              <td className="py-1 text-right">{results.stages[s].skipped}</td>
              <td className="py-1 text-right">{results.stages[s].orders}</td>
              <td className="py-1 text-right">{money(results.stages[s].revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs italic text-ink/60">{t("results_note")}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-ink/10 p-2">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-ink/60">{label}</div>
    </div>
  );
}
