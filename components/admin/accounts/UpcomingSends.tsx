// components/admin/accounts/UpcomingSends.tsx
"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import AdminButton from "@/components/admin/dashboard/AdminButton";
import type { UpcomingSend } from "@/lib/house-account-sends";
import { sendLabel, type Translate } from "./send-label";

type Props = {
  locale: string;
  rows: UpcomingSend[];
  busy: boolean;
  onAction: (id: string, action: "sendNow" | "skip") => void;
};

export default function UpcomingSends({ locale, rows, busy, onAction }: Props) {
  const t = useTranslations("admin_accounts");
  return (
    <section className="mb-5 rounded-xl border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("upcoming_title")}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-ink/50">{t("upcoming_empty")}</div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-28 tabular-nums text-ink/70">{formatDateOnly(r.scheduledFor, locale)}</span>
              <Link href={`/${locale}/admin/accounts/${r.accountId}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                {r.accountName}
              </Link>
              <span className="text-ink/70">{sendLabel(r.kind, r.scheduledFor, r.dueDate, t as unknown as Translate)} · {r.statementNumber} · {t(`channel_${r.channel}`)}</span>
              <span className="ml-auto flex gap-2">
                <AdminButton variant="primary" disabled={busy} onClick={() => onAction(r.id, "sendNow")}>{t("send_now")}</AdminButton>
                <AdminButton variant="secondary" disabled={busy} onClick={() => onAction(r.id, "skip")}>{t("skip")}</AdminButton>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
