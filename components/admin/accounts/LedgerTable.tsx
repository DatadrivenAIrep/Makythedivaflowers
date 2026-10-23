"use client";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/format-datetime";
import type { LedgerView } from "@/lib/house-account-detail";
import type { AccountPaymentMethod } from "@/types/house-account";

type Props = { locale: string; entries: LedgerView[]; onOpenOrder: (orderId: string) => void };
function money(c: number) { return `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`; }
const METHOD_KEY: Record<AccountPaymentMethod, string> = {
  cash: "method_cash", zelle: "method_zelle", ach: "method_ach", check: "method_check", "card-terminal": "method_card_terminal", stripe: "method_stripe",
};

export default function LedgerTable({ locale, entries, onOpenOrder }: Props) {
  const t = useTranslations("admin_accounts");
  if (entries.length === 0) return <div className="text-sm text-ink/50">{t("led_empty")}</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
        <th className="px-2 py-1">{t("led_date")}</th><th className="px-2 py-1">{t("led_detail")}</th>
        <th className="px-2 py-1 text-right">{t("led_amount")}</th><th className="px-2 py-1 text-right">{t("led_running")}</th>
      </tr></thead>
      <tbody className="divide-y divide-ink/10">
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="px-2 py-2 tabular-nums text-ink/70">{formatDate(e.createdAt, locale)}</td>
            <td className="px-2 py-2">
              <span className="font-medium">{t(`kind_${e.kind}`)}{e.method ? ` · ${t(METHOD_KEY[e.method])}` : ""}</span>
              {e.orderId && (
                <button type="button" onClick={() => onOpenOrder(e.orderId!)} className="ml-2 underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                  #{e.orderId.slice(-6)}
                </button>
              )}
              {e.note && <span className="text-ink/60"> · {e.note}</span>}
              {!e.statementId && e.kind !== "payment" && (
                <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">{t("unbilled")}</span>
              )}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums ${e.amountCents < 0 ? "text-emerald-700" : ""}`}>{money(e.amountCents)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-ink/70">{money(e.runningCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
