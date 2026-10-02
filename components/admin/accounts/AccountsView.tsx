// components/admin/accounts/AccountsView.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateOnly } from "@/lib/format-datetime";
import type { AccountListItem, AccountFilter } from "@/lib/house-account-storage";
import type { UpcomingSend } from "@/lib/house-account-sends";
import AccountStatusBadge from "./AccountStatusBadge";
import UpcomingSends from "./UpcomingSends";
import NewAccountModal from "./NewAccountModal";

type Props = { locale: string; initialAccounts: AccountListItem[]; initialUpcoming: UpcomingSend[] };

function money(c: number) {
  return `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
}

const FILTERS: AccountFilter[] = ["all", "with_balance", "overdue", "paused"];

export default function AccountsView({ locale, initialAccounts, initialUpcoming }: Props) {
  const t = useTranslations("admin_accounts");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh(f: AccountFilter = filter, query: string = q) {
    const res = await fetch(`/api/admin/accounts?filter=${f}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { accounts: AccountListItem[]; upcoming: UpcomingSend[] };
    setAccounts(d.accounts);
    setUpcoming(d.upcoming);
  }

  async function sendAction(id: string, action: "sendNow" | "skip") {
    setBusy(true);
    try {
      await fetch(`/api/admin/accounts/sends/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "skip" ? { skip: true } : { sendNow: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/${locale}/admin/dashboard`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-rouge hover:underline">
        <ArrowLeft size={15} weight="bold" /> {t("back_to_dashboard")}
      </Link>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink/55">{t("subtitle")}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rouge px-4 py-2.5 text-sm font-bold text-bone hover:bg-rouge/90">
          <Plus size={16} weight="bold" /> {t("new_account")}
        </button>
      </div>

      <UpcomingSends locale={locale} rows={upcoming} busy={busy} onAction={sendAction} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); void refresh(f); }}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${filter === f ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"}`}>
            {t(`filter_${f}`)}
          </button>
        ))}
        <input value={q} placeholder={t("search_placeholder")} aria-label={t("search_placeholder")}
          onChange={(e) => { setQ(e.target.value); void refresh(filter, e.target.value); }}
          className="ml-auto min-h-11 w-56 rounded-lg border border-ink/20 bg-white px-3 text-sm" />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-bone p-10 text-center text-ink/55">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-bone">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">{t("col_name")}</th>
                <th className="px-3 py-2 text-right">{t("col_balance")}</th>
                <th className="px-3 py-2">{t("col_oldest")}</th>
                <th className="px-3 py-2">{t("col_next_issue")}</th>
                <th className="px-3 py-2">{t("col_last_payment")}</th>
                <th className="px-3 py-2">{t("col_status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    <Link href={`/${locale}/admin/accounts/${a.id}`} className="font-medium underline decoration-ink/30 underline-offset-2 hover:decoration-ink">{a.name}</Link>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${a.balanceCents > 0 ? "font-semibold" : "text-ink/60"}`}>{money(a.balanceCents)}</td>
                  <td className="px-3 py-2">
                    {a.oldestOpen ? (
                      <span>
                        {a.oldestOpen.number} · {formatDateOnly(a.oldestOpen.dueDate, locale)}
                        {a.overdue && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{t("overdue")}</span>}
                      </span>
                    ) : <span className="text-ink/40">—</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{a.status === "active" ? formatDateOnly(a.nextIssueDate, locale) : <span className="text-ink/40">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{a.lastPaymentAt ? formatDate(a.lastPaymentAt, locale) : <span className="text-ink/40">—</span>}</td>
                  <td className="px-3 py-2"><AccountStatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewAccountModal locale={locale} onClose={() => setCreating(false)} />}
    </div>
  );
}
