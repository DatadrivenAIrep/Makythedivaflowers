"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { StatementView } from "@/lib/house-account-detail";
import type { SendChannel } from "@/types/house-account";

type Props = {
  locale: string; statements: StatementView[]; defaultChannel: SendChannel; busy: boolean;
  onSend: (sid: string, channel: SendChannel) => void; onVoid: (sid: string) => void;
};
const COLS = "sm:grid-cols-[6.5rem_6rem_minmax(0,1.6fr)_6rem_6rem_6rem] sm:items-center";
function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
const STATUS_CLS: Record<string, string> = { open: "bg-amber-500/15 text-amber-700", paid: "bg-emerald-600/10 text-emerald-700", void: "bg-ink/10 text-ink/45 line-through" };

export default function StatementsTable({ locale, statements, defaultChannel, busy, onSend, onVoid }: Props) {
  const t = useTranslations("admin_accounts");
  const [channel, setChannel] = useState<Record<string, SendChannel>>({});
  const [copied, setCopied] = useState<string | null>(null);
  if (statements.length === 0) return <div className="text-sm text-ink/50">{t("st_empty")}</div>;
  return (
    <div className="text-sm">
      <div aria-hidden="true" className={`hidden px-2 py-1 text-left text-xs uppercase tracking-wide text-ink/50 sm:grid ${COLS}`}>
        <span>{t("st_number")}</span><span>{t("st_status")}</span><span>{t("st_period")}</span><span>{t("st_due")}</span>
        <span className="text-right">{t("st_closing")}</span><span className="text-right">{t("st_due_amount")}</span>
      </div>
      <ul className="divide-y divide-ink/10">
        {statements.map((s) => (
          <li key={s.id} className={`grid grid-cols-2 gap-x-3 gap-y-1 py-3 sm:px-2 sm:py-2 ${COLS}`}>
            <span className="font-medium">{s.number}</span>
            <span className="justify-self-end sm:justify-self-start"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`st_${s.status}`)}</span></span>
            <span className="col-span-2 tabular-nums sm:col-span-1 sm:whitespace-nowrap">{formatDateOnly(s.periodStart, locale)} – {formatDateOnly(s.periodEnd, locale)}</span>
            <span className="col-span-2 tabular-nums sm:col-span-1 sm:whitespace-nowrap"><span className="text-xs text-ink/50 sm:hidden">{t("st_due")}: </span>{formatDateOnly(s.dueDate, locale)}</span>
            <span className="tabular-nums sm:text-right"><span className="block text-xs text-ink/50 sm:hidden">{t("st_closing")}</span>{money(s.closingCents)}</span>
            <span className="text-right tabular-nums"><span className="block text-xs text-ink/50 sm:hidden">{t("st_due_amount")}</span>{money(s.dueCents)}</span>
            <div className="col-span-2 mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-full">
              <a href={`/s/${s.code}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs text-rouge underline">{t("view")}</a>
              <button type="button" className="min-h-11 text-xs text-rouge underline" onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/s/${s.code}`);
                setCopied(s.id); setTimeout(() => setCopied(null), 1500);
              }}>{copied === s.id ? t("link_copied") : t("copy_link")}</button>
              {s.status !== "void" && (
                <>
                  <select aria-label={t("send_channel_pick")} value={channel[s.id] ?? defaultChannel}
                    onChange={(e) => setChannel((c) => ({ ...c, [s.id]: e.target.value as SendChannel }))}
                    className="min-h-11 rounded-lg border border-ink/20 bg-white px-2 text-sm">
                    {(["sms", "email", "both"] as SendChannel[]).map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
                  </select>
                  <AdminButton variant="primary" disabled={busy} onClick={() => onSend(s.id, channel[s.id] ?? defaultChannel)}>{t("send_short")}</AdminButton>
                </>
              )}
              {s.status === "open" && (
                <button type="button" disabled={busy} className="min-h-11 text-xs text-error underline disabled:opacity-40"
                  onClick={() => { if (window.confirm(t("void_confirm"))) onVoid(s.id); }}>{t("void")}</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
