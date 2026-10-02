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
function money(c: number) { return `$${(c / 100).toFixed(2)}`; }
const STATUS_CLS: Record<string, string> = { open: "bg-amber-500/15 text-amber-700", paid: "bg-emerald-600/10 text-emerald-700", void: "bg-ink/10 text-ink/45 line-through" };

export default function StatementsTable({ locale, statements, defaultChannel, busy, onSend, onVoid }: Props) {
  const t = useTranslations("admin_accounts");
  const [channel, setChannel] = useState<Record<string, SendChannel>>({});
  const [copied, setCopied] = useState<string | null>(null);
  if (statements.length === 0) return <div className="text-sm text-ink/50">{t("st_empty")}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink/50">
          <th className="px-2 py-1">{t("st_number")}</th><th className="px-2 py-1">{t("st_period")}</th><th className="px-2 py-1">{t("st_due")}</th>
          <th className="px-2 py-1 text-right">{t("st_closing")}</th><th className="px-2 py-1 text-right">{t("st_due_amount")}</th><th className="px-2 py-1">{t("st_status")}</th><th className="px-2 py-1"></th>
        </tr></thead>
        <tbody className="divide-y divide-ink/10">
          {statements.map((s) => (
            <tr key={s.id}>
              <td className="px-2 py-2 font-medium">{s.number}</td>
              <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.periodStart, locale)} – {formatDateOnly(s.periodEnd, locale)}</td>
              <td className="px-2 py-2 tabular-nums">{formatDateOnly(s.dueDate, locale)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{money(s.closingCents)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{money(s.dueCents)}</td>
              <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{t(`st_${s.status}`)}</span></td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  <AdminButton variant="secondary" href={`/s/${s.code}`} target="_blank" rel="noreferrer">{t("view")}</AdminButton>
                  <AdminButton variant="secondary" onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/s/${s.code}`);
                    setCopied(s.id); setTimeout(() => setCopied(null), 1500);
                  }}>{copied === s.id ? t("link_copied") : t("copy_link")}</AdminButton>
                  {s.status !== "void" && (
                    <>
                      <select aria-label={t("send_channel_pick")} value={channel[s.id] ?? defaultChannel}
                        onChange={(e) => setChannel((c) => ({ ...c, [s.id]: e.target.value as SendChannel }))}
                        className="rounded-lg border border-ink/20 bg-white px-2 py-1.5 text-sm">
                        {(["sms", "email", "both"] as SendChannel[]).map((c) => <option key={c} value={c}>{t(`channel_${c}`)}</option>)}
                      </select>
                      <AdminButton variant="primary" disabled={busy} onClick={() => onSend(s.id, channel[s.id] ?? defaultChannel)}>{t("send_now")}</AdminButton>
                    </>
                  )}
                  {s.status === "open" && (
                    <AdminButton variant="danger" disabled={busy} onClick={() => { if (window.confirm(t("void_confirm"))) onVoid(s.id); }}>{t("void")}</AdminButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
