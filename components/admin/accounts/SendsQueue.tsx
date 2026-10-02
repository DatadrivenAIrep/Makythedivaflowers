"use client";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { ScheduledSend } from "@/types/house-account";

type Props = { locale: string; sends: ScheduledSend[]; numbers: Record<string, string>; busy: boolean; onAction: (id: string, action: "sendNow" | "skip" | "reschedule", date?: string) => void };
const STATUS_CLS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800", sending: "bg-sky-100 text-sky-800", sent: "bg-emerald-600/10 text-emerald-700",
  skipped: "bg-ink/10 text-ink/55", failed: "bg-rose-100 text-rose-700", canceled: "bg-ink/10 text-ink/45 line-through",
};

export default function SendsQueue({ locale, sends, numbers, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  if (sends.length === 0) return <div className="text-sm text-ink/50">{t("queue_empty")}</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
        <th className="px-2 py-1">{t("queue_when")}</th><th className="px-2 py-1">{t("queue_what")}</th><th className="px-2 py-1">{t("queue_channel")}</th>
        <th className="px-2 py-1">{t("queue_status")}</th><th className="px-2 py-1">{t("queue_detail")}</th><th className="px-2 py-1"></th>
      </tr></thead>
      <tbody className="divide-y divide-ink/10">
        {sends.map((s) => (
          <tr key={s.id}>
            <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.scheduledFor, locale)}</td>
            <td className="px-2 py-2">{t(`kind_${s.kind}`)} · {numbers[s.statementId] ?? s.statementId}</td>
            <td className="px-2 py-2">{t(`channel_${s.channel}`)}</td>
            <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`send_status_${s.status}`)}</span></td>
            <td className="max-w-xs truncate px-2 py-2 text-xs text-ink/60" title={s.error ?? s.body ?? ""}>{s.error ?? (s.smsSid ? s.smsSid : "")}</td>
            <td className="px-2 py-2">
              {s.status === "scheduled" && (
                <div className="flex gap-1">
                  <AdminButton variant="primary" disabled={busy} onClick={() => onAction(s.id, "sendNow")}>{t("send_now")}</AdminButton>
                  <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(s.id, "skip")}>{t("skip")}</AdminButton>
                  <AdminButton variant="secondary" disabled={busy} onClick={() => {
                    const d = window.prompt(t("reschedule_prompt"), s.scheduledFor);
                    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) onAction(s.id, "reschedule", d);
                  }}>{t("reschedule")}</AdminButton>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
