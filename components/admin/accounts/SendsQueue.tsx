"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import { shopDateStr } from "@/lib/tv-slots";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { ScheduledSend } from "@/types/house-account";
import { sendLabel, type Translate } from "./send-label";

type StatementRef = { number: string; dueDate: string };
type Props = {
  locale: string; sends: ScheduledSend[]; statements: Record<string, StatementRef>; busy: boolean;
  onAction: (id: string, action: "sendNow" | "skip" | "reschedule", date?: string) => Promise<boolean>;
};
const STATUS_CLS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800", sending: "bg-sky-100 text-sky-800", sent: "bg-emerald-600/10 text-emerald-700",
  skipped: "bg-ink/10 text-ink/55", failed: "bg-rose-100 text-rose-700", canceled: "bg-ink/10 text-ink/45 line-through",
};
const PENDING = new Set(["scheduled", "sending"]);
// One grid definition shared by the header and every row (from `lg` up; stacked blocks below).
// Every track is fixed or fr, never `auto`: the header and each row are separate grids, so a
// content-sized track would resolve differently in each and the columns would drift apart.
const COLS = "lg:grid lg:grid-cols-[6.5rem_minmax(0,1fr)_6rem_6.5rem_17rem] lg:items-center lg:gap-x-2";

export default function SendsQueue({ locale, sends, statements, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  if (sends.length === 0) return <div className="text-sm text-ink/50">{t("queue_empty")}</div>;

  const today = shopDateStr(new Date());
  const upcoming = sends.filter((s) => PENDING.has(s.status)).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const history = sends.filter((s) => !PENDING.has(s.status)).sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  function row(s: ScheduledSend) {
    const st = statements[s.statementId];
    const label = sendLabel(s.kind, s.scheduledFor, st?.dueDate, t as unknown as Translate);
    const due = s.scheduledFor <= today;
    const detail = s.error ?? s.smsSid ?? "";
    return (
      <li key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 lg:py-2 ${COLS} lg:px-2`}>
        <span className="w-full whitespace-nowrap font-medium tabular-nums lg:w-auto lg:font-normal">{formatDateOnly(s.scheduledFor, locale)}</span>
        <span className="w-full min-w-0 lg:w-auto">
          {label} · {st?.number ?? s.statementId}
          {detail && <span className="block truncate text-xs text-ink/60" title={s.error ?? s.body ?? ""}>{detail}</span>}
        </span>
        <span>{t(`channel_${s.channel}`)}</span>
        <span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`send_status_${s.status}`)}</span></span>
        <div className="mt-1 w-full lg:mt-0 lg:w-auto">
          {s.status === "scheduled" && (editingId === s.id ? (
            <div className="flex flex-wrap items-center gap-1">
              <input type="date" aria-label={t("reschedule_date")} min={today} value={date} onChange={(e) => setDate(e.target.value)}
                className="min-h-11 rounded-lg border border-ink/20 bg-white px-2 text-sm" />
              <AdminButton variant="primary" disabled={busy || !date || date < today}
                onClick={async () => { if (await onAction(s.id, "reschedule", date)) setEditingId(null); }}>{t("reschedule_apply")}</AdminButton>
              <AdminButton variant="secondary" onClick={() => setEditingId(null)}>{t("cancel")}</AdminButton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <AdminButton variant={due ? "primary" : "secondary"} disabled={busy} onClick={() => onAction(s.id, "sendNow")}>{t("send_now")}</AdminButton>
              <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(s.id, "skip")}>{t("skip")}</AdminButton>
              <AdminButton variant="secondary" disabled={busy} onClick={() => { setEditingId(s.id); setDate(s.scheduledFor < today ? today : s.scheduledFor); }}>{t("reschedule")}</AdminButton>
            </div>
          ))}
        </div>
      </li>
    );
  }

  function group(title: string, rows: ScheduledSend[]) {
    if (rows.length === 0) return null;
    return (
      <div className="mb-3 last:mb-0">
        <h3 className="mb-1 text-xs font-semibold text-ink/70">{title}</h3>
        <div aria-hidden="true" className={`hidden px-2 py-1 text-left text-xs uppercase tracking-wide text-ink/50 ${COLS}`}>
          <span>{t("queue_when")}</span><span>{t("queue_what")}</span><span>{t("queue_channel")}</span>
          <span>{t("queue_status")}</span><span />
        </div>
        <ul className="divide-y divide-ink/10 text-sm">{rows.map(row)}</ul>
      </div>
    );
  }

  return <>{group(t("queue_upcoming"), upcoming)}{group(t("queue_history"), history)}</>;
}
