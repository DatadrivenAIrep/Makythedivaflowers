"use client";
import { useCallback, useEffect, useState } from "react";
import { ChatCircleText, Check, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";

type Receivable = {
  orderId: string;
  orderNumber: number | null;
  buyerName: string;
  phone: string;
  method: "delivery" | "pickup" | "in-store";
  dueDate: string;
  daysOverdue: number;
  balanceCents: number;
  canRemind: boolean;
  lastReminderAt?: string;
};
type Resp = { items: Receivable[]; totalCents: number };
type RowMsg = { ok: boolean; text: string };

const COLLAPSED = 5;
const METHODS = ["cash", "zelle", "card-terminal", "ach"] as const;
const METHOD_KEY: Record<(typeof METHODS)[number], string> = { cash: "cash", zelle: "zelle", "card-terminal": "card_terminal", ach: "ach" };

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

type Props = {
  locale: string;
  /** Bumped by the parent after anything that may change balances (drawer edits, refresh). */
  version: number;
  onOpen: (orderId: string) => void;
};

/** "Por cobrar": past orders that still owe money, with one-tap collection actions. */
export default function ReceivablesSection({ locale, version, onOpen }: Props) {
  const t = useTranslations("admin_dashboard");
  const to = useTranslations("admin_orders");
  const [data, setData] = useState<Resp | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, RowMsg>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/orders/receivables", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Resp);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  const dateFmt = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { month: "short", day: "numeric" });

  function reason(r: string): string {
    switch (r) {
      case "already_sent": return t("remind_already_sent");
      case "opted_out": return t("remind_opted_out");
      case "link_failed": return t("remind_link_failed");
      case "sms_disabled": return t("remind_sms_off");
      default: return t("remind_failed");
    }
  }

  async function remind(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}/remind`, { method: "POST" });
      const d = (await res.json().catch(() => ({ ok: false, reason: "" }))) as { ok: boolean; reason?: string };
      setMsgs((m) => ({ ...m, [id]: d.ok ? { ok: true, text: t("remind_sent") } : { ok: false, text: reason(d.reason ?? "") } }));
      if (d.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(r: Receivable, method?: (typeof METHODS)[number]) {
    setBusyId(r.orderId);
    try {
      // A pending order is paid with a method; one already marked paid only has its leftover settled.
      const body = r.canRemind ? { method } : { settleBalance: true };
      const res = await fetch(`/api/admin/orders/${r.orderId}/payment`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        setPayingId(null);
        await load();
      } else {
        setMsgs((m) => ({ ...m, [r.orderId]: { ok: false, text: t("remind_failed") } }));
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return null;
  const shown = expanded ? data.items : data.items.slice(0, COLLAPSED);

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
        {t("receivables")} · {data.items.length}{data.totalCents > 0 && ` · ${money(data.totalCents)}`}
      </h2>
      {data.items.length === 0 ? (
        <p className="rounded-lg border border-ink/10 bg-bone p-4 text-sm text-ink/60">{t("receivables_none")}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const busy = busyId === r.orderId;
            const msg = msgs[r.orderId];
            return (
              <li key={r.orderId} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <button type="button" onClick={() => onOpen(r.orderId)} className="text-left font-semibold hover:underline">
                    {r.buyerName}{r.orderNumber != null && <span className="font-normal text-ink/50"> · #{r.orderNumber}</span>}
                  </button>
                  <span className="font-semibold tabular-nums text-amber-800">{money(r.balanceCents)}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink/60">
                  {dateFmt(r.dueDate)} · {t("receivables_days", { days: r.daysOverdue })}
                  {r.lastReminderAt && <> · {t("receivables_reminded", { date: dateFmt(r.lastReminderAt) })}</>}
                  {!r.canRemind && <> · {t("receivables_collect_by_hand")}</>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.canRemind && (
                    <AdminButton variant="secondary" icon={ChatCircleText} disabled={busy} onClick={() => remind(r.orderId)}>
                      {t("receivables_remind")}
                    </AdminButton>
                  )}
                  <AdminButton variant="secondary" icon={Check} disabled={busy}
                    onClick={() => (r.canRemind ? setPayingId(payingId === r.orderId ? null : r.orderId) : markPaid(r))}>
                    {t("action_mark_paid")}
                  </AdminButton>
                  <AdminButton variant="secondary" icon={ArrowRight} onClick={() => onOpen(r.orderId)}>{t("action_open_detail")}</AdminButton>
                </div>
                {payingId === r.orderId && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs" role="group" aria-label={t("action_mark_paid")}>
                    {METHODS.map((m) => (
                      <button key={m} type="button" disabled={busy} onClick={() => markPaid(r, m)}
                        className="rounded-full border border-ink/20 bg-bone px-2.5 py-1 hover:border-ink disabled:opacity-40">
                        {to(METHOD_KEY[m])}
                      </button>
                    ))}
                  </div>
                )}
                {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {data.items.length > COLLAPSED && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm text-rouge hover:underline">
          {expanded ? t("receivables_show_less") : t("receivables_show_all", { count: data.items.length })}
        </button>
      )}
    </section>
  );
}
