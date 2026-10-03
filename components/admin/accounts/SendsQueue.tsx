"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { ScheduledSend } from "@/types/house-account";
import { sendLabel, type Translate } from "./send-label";

type StatementRef = { number: string; dueDate: string };
type Props = {
  locale: string; sends: ScheduledSend[]; statements: Record<string, StatementRef>; busy: boolean;
  onAction: (id: string, action: "sendNow" | "skip" | "reschedule", date?: string) => void;
};
const STATUS_CLS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800", sending: "bg-sky-100 text-sky-800", sent: "bg-emerald-600/10 text-emerald-700",
  skipped: "bg-ink/10 text-ink/55", failed: "bg-rose-100 text-rose-700", canceled: "bg-ink/10 text-ink/45 line-through",
};
const PENDING = new Set(["scheduled", "sending"]);

export default function SendsQueue({ locale, sends, statements, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  if (sends.length === 0) return <div className="text-sm text-ink/50">{t("queue_empty")}</div>;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sends.filter((s) => PENDING.has(s.status)).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const history = sends.filter((s) => !PENDING.has(s.status)).sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  function row(s: ScheduledSend) {
    const st = statements[s.statementId];
    const label = sendLabel(s.kind, s.scheduledFor, st?.dueDate, t as unknown as Translate);
    return (
      <tr key={s.id}>
        <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDateOnly(s.scheduledFor, locale)}</td>
        <td className="px-2 py-2">{label} · {st?.number ?? s.statementId}</td>
        <td className="px-2 py-2">{t(`channel_${s.channel}`)}</td>
        <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`send_status_${s.status}`)}</span></td>
        <td className="max-w-xs truncate px-2 py-2 text-xs text-ink/60" title={s.error ?? s.body ?? ""}>{s.error ?? (s.smsSid ? s.smsSid : "")}</td>
        <td className="px-2 py-2">
          {s.status === "scheduled" && (editingId === s.id ? (
            <div className="flex flex-wrap items-center gap-1">
              <input type="date" aria-label={t("reschedule_date")} min={today} value={date} onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm" />
              <AdminButton variant="primary" disabled={busy || !date || date < today} onClick={() => { onAction(s.id, "reschedule", date); setEditingId(null); }}>{t("reschedule_apply")}</AdminButton>
              <AdminButton variant="secondary" onClick={() => setEditingId(null)}>{t("cancel")}</AdminButton>
            </div>
          ) : (
            <div className="flex gap-1">
              <AdminButton variant="primary" disabled={busy} onClick={() => onAction(s.id, "sendNow")}>{t("send_now")}</AdminButton>
              <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(s.id, "skip")}>{t("skip")}</AdminButton>
              <AdminButton variant="secondary" disabled={busy} onClick={() => { setEditingId(s.id); setDate(s.scheduledFor < today ? today : s.scheduledFor); }}>{t("reschedule")}</AdminButton>
            </div>
          ))}
        </td>
      </tr>
    );
  }

  function group(title: string, rows: ScheduledSend[]) {
    if (rows.length === 0) return null;
    return (
      <div className="mb-3 last:mb-0">
        <h3 className="mb-1 text-xs font-semibold text-ink/70">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
              <th className="px-2 py-1">{t("queue_when")}</th><th className="px-2 py-1">{t("queue_what")}</th><th className="px-2 py-1">{t("queue_channel")}</th>
              <th className="px-2 py-1">{t("queue_status")}</th><th className="px-2 py-1">{t("queue_detail")}</th><th className="px-2 py-1"></th>
            </tr></thead>
            <tbody className="divide-y divide-ink/10">{rows.map(row)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  return <>{group(t("queue_upcoming"), upcoming)}{group(t("queue_history"), history)}</>;
}
