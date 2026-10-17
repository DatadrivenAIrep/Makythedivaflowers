"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import DashboardShell from "./DashboardShell";
import AdminButton from "./AdminButton";
import { addDaysStr, shopDateStr, SHOP_TZ } from "@/lib/tv-slots";
import {
  MONEY_METHODS, expectedCash, closeDifference, parseMoneyCents,
  type DaySummary, type MoneyMethod,
} from "@/lib/cash-close";
import type { CashClose } from "@/lib/cash-close-storage"; // type only: that module is server-only
import type { PaymentKind, PaymentRowMethod } from "@/lib/payments-storage";

type PaymentLine = {
  id: string;
  at: string;
  kind: PaymentKind;
  method: PaymentRowMethod;
  amountCents: number;
  orderNumber?: number;
  customerName?: string;
};

type Sales = {
  orders: number; subtotalCents: number; taxCents: number; tipCents: number;
  deliveryCents: number; discountCents: number; pendingCents: number;
};

type Data = {
  day: string;
  firstDay: string | null;
  payments: PaymentLine[];
  summary: DaySummary;
  close: CashClose | null;
  changeSinceCloseCents: number;
  previousFloatCents: number;
  sales: Sales;
  history: CashClose[];
};

function money(c: number) {
  return `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
}

/** Cents → what the field shows ("100" / "12.50"). */
function centsText(c: number) {
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
}

const timeFmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: SHOP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

const dateTimeFmt = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeZone: SHOP_TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

const dayLabel = (day: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${day}T12:00:00Z`));

const diffClass = (d: number) => (d === 0 ? "text-emerald-700" : d < 0 ? "text-rouge" : "text-amber-700");

type Form = {
  opening: string;
  cashOut: string;
  cashOutNote: string;
  counted: string;
  /** null = follows the opening float until Maky types something. */
  floatLeft: string | null;
  note: string;
  reviewed: Set<string>;
};

function formFrom(d: Data): Form {
  const c = d.close;
  return {
    opening: centsText(c?.openingFloatCents ?? d.previousFloatCents),
    cashOut: c ? centsText(c.cashOutCents) : "",
    cashOutNote: c?.cashOutNote ?? "",
    counted: c ? centsText(c.countedCents) : "",
    floatLeft: c ? centsText(c.floatLeftCents) : null,
    note: c?.note ?? "",
    reviewed: new Set(c?.reviewed ?? []),
  };
}

/** Empty means 0 for the optional amounts; anything else must parse. */
const optionalCents = (text: string) => (text.trim() === "" ? 0 : parseMoneyCents(text));

function MoneyField({ label, value, onChange, invalid, invalidText }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  invalidText: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink/70">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={`mt-1 block min-h-11 w-full rounded-lg border bg-bone px-3 tabular-nums ${invalid ? "border-rouge" : "border-ink/20"}`}
      />
      {invalid && <span className="mt-1 block text-xs text-rouge">{invalidText}</span>}
    </label>
  );
}

function Row({ label, value, testId, valueClass = "", extra }: {
  label: string; value: string; testId?: string; valueClass?: string; extra?: string;
}) {
  return (
    <div data-testid={testId} className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-ink/70">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>
        {value}
        {extra && <span className="ml-2 text-xs">{extra}</span>}
      </span>
    </div>
  );
}

export default function CashCloseView({ locale }: { locale: string }) {
  const t = useTranslations("admin_cash_close");
  const activeLocale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");

  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    setError(false);
    const qs = dayParam ? `?day=${encodeURIComponent(dayParam)}` : "";
    fetch(`/api/admin/cash-close${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!live) return;
        setData(d);
        setForm(formFrom(d));
      })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [dayParam, reloadKey]);

  const goToDay = useCallback((day: string) => {
    setSavedAt(null);
    setSaveError(false);
    router.replace(`/${locale}/admin/dashboard/cierre?day=${day}`);
  }, [router, locale]);

  if (!data || !form) {
    return (
      <DashboardShell locale={locale}>
        <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">
          {error ? t("load_error") : t("loading")}
        </p>
      </DashboardShell>
    );
  }

  const today = shopDateStr(new Date());
  const { summary } = data;
  const beforeLaunch = data.firstDay === null || data.day < data.firstDay;

  const opening = optionalCents(form.opening);
  const cashOut = optionalCents(form.cashOut);
  const counted = form.counted.trim() === "" ? null : parseMoneyCents(form.counted);
  const floatLeft = optionalCents(form.floatLeft ?? form.opening);
  const valid = opening !== null && cashOut !== null && counted !== null && floatLeft !== null;
  const expected = opening !== null && cashOut !== null
    ? expectedCash({ openingFloatCents: opening, cashInCents: summary.cashInCents, cashRefundsCents: summary.cashRefundsCents, cashOutCents: cashOut })
    : null;
  const difference = expected !== null && counted !== null ? closeDifference(counted, expected) : null;

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  function toggleReviewed(m: string) {
    const next = new Set(form!.reviewed);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    set({ reviewed: next });
  }

  async function save() {
    if (!valid || !form) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/admin/cash-close", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: data!.day,
          openingFloatCents: opening,
          cashOutCents: cashOut,
          ...(form.cashOutNote.trim() ? { cashOutNote: form.cashOutNote.trim() } : {}),
          countedCents: counted,
          floatLeftCents: floatLeft,
          reviewed: MONEY_METHODS.filter((m) => form.reviewed.has(m)),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { close: { updatedAt: string } };
      setSavedAt(timeFmt(body.close.updatedAt));
      setReloadKey((k) => k + 1);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const visibleMethods = MONEY_METHODS.filter((m) => {
    const hasRows = data.payments.some((p) => p.method === m);
    return !((m === "unknown" || m === "check") && summary.byMethod[m] === 0 && !hasRows);
  });
  const invalidText = t("invalid_amount");

  return (
    <DashboardShell locale={locale}>
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center justify-between gap-2">
          <AdminButton variant="secondary" icon={CaretLeft} aria-label={t("prev_day")} onClick={() => goToDay(addDaysStr(data.day, -1))} />
          <h1 className="text-center text-base font-semibold capitalize text-ink">{dayLabel(data.day, activeLocale)}</h1>
          <AdminButton variant="secondary" icon={CaretRight} aria-label={t("next_day")} disabled={data.day >= today} onClick={() => goToDay(addDaysStr(data.day, 1))} />
        </header>

        {beforeLaunch ? (
          <p className="rounded border border-ink/10 bg-bone p-4 text-sm text-ink/60">
            {data.firstDay === null ? t("empty_none") : t("empty_before", { day: data.firstDay })}
          </p>
        ) : (
          <>
            {data.close && data.changeSinceCloseCents !== 0 && (
              <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                {t("changed_since_close", { amount: money(data.changeSinceCloseCents) })}
              </p>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">{t("collected_title")}</h2>
              {visibleMethods.map((m: MoneyMethod) => {
                const rows = data.payments.filter((p) => p.method === m);
                return (
                  <div key={m} className="rounded-lg border border-ink/10 bg-bone p-3 text-sm">
                    <details>
                      <summary className="flex cursor-pointer items-center gap-3">
                        <span className="font-medium">{t(`method.${m}`)}</span>
                        <span className="text-xs text-ink/50">{t("payments_count", { count: rows.length })}</span>
                        <span className="ml-auto font-semibold tabular-nums">{money(summary.byMethod[m])}</span>
                      </summary>
                      <ul className="mt-2 space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/70">
                        {rows.map((p) => (
                          <li key={p.id} className="flex items-baseline gap-2">
                            <span className="tabular-nums">{timeFmt(p.at)}</span>
                            {p.orderNumber != null && <span>#{p.orderNumber}</span>}
                            {p.customerName && <span className="truncate">{p.customerName}</span>}
                            <span className="text-ink/50">{t(`kind.${p.kind}`)}</span>
                            <span className={`ml-auto tabular-nums ${p.amountCents < 0 ? "text-rouge" : ""}`}>{money(p.amountCents)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                    {m !== "cash" && (
                      <label className="mt-2 flex w-fit items-center gap-2 text-xs text-ink/70">
                        <input
                          type="checkbox"
                          checked={form.reviewed.has(m)}
                          onChange={() => toggleReviewed(m)}
                          className="h-4 w-4 accent-ink"
                        />
                        {t("reviewed")}
                      </label>
                    )}
                  </div>
                );
              })}
              <div className="flex items-baseline justify-between px-3 pt-1 text-base">
                <span className="font-semibold">{t("total_collected")}</span>
                <span className="font-bold tabular-nums">{money(summary.totalCollectedCents)}</span>
              </div>
              {summary.giftCardRedeemedCents !== 0 && (
                <p className="px-3 text-xs text-ink/50">
                  {t("gift_card_used")}: {money(summary.giftCardRedeemedCents)}
                </p>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-ink/10 bg-bone p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">{t("cuadre_title")}</h2>
              <MoneyField label={t("opening_float")} value={form.opening} onChange={(v) => set({ opening: v })} invalid={opening === null} invalidText={invalidText} />
              <Row label={t("cash_collected")} value={money(summary.cashInCents)} />
              <Row label={t("cash_refunds")} value={money(-summary.cashRefundsCents)} />
              <MoneyField label={t("cash_out")} value={form.cashOut} onChange={(v) => set({ cashOut: v })} invalid={cashOut === null} invalidText={invalidText} />
              <label className="block text-sm">
                <span className="text-ink/70">{t("cash_out_note")}</span>
                <input
                  type="text"
                  value={form.cashOutNote}
                  maxLength={200}
                  onChange={(e) => set({ cashOutNote: e.target.value })}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-ink/20 bg-bone px-3"
                />
              </label>
              <div className="border-t border-ink/10 pt-2">
                <Row testId="expected-row" label={t("expected")} value={expected === null ? "—" : money(expected)} valueClass="font-semibold" />
              </div>
              <MoneyField label={t("counted")} value={form.counted} onChange={(v) => set({ counted: v })} invalid={form.counted.trim() !== "" && counted === null} invalidText={invalidText} />
              <Row
                testId="difference-row"
                label={t("difference")}
                value={difference === null ? "—" : money(difference)}
                valueClass={`font-bold ${difference === null ? "" : diffClass(difference)}`}
                extra={difference === null || difference === 0 ? undefined : difference < 0 ? t("short") : t("over")}
              />
              <MoneyField label={t("float_left")} value={form.floatLeft ?? form.opening} onChange={(v) => set({ floatLeft: v })} invalid={floatLeft === null} invalidText={invalidText} />
              <label className="block text-sm">
                <span className="text-ink/70">{t("note")}</span>
                <textarea
                  value={form.note}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => set({ note: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-ink/20 bg-bone px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <AdminButton variant="primary" onClick={() => void save()} disabled={!valid || saving}>
                  {t("save")}
                </AdminButton>
                {savedAt && <span className="text-sm text-emerald-700">{t("saved", { time: savedAt })}</span>}
                {saveError && <span role="alert" className="text-sm text-rouge">{t("save_error")}</span>}
              </div>
            </section>

            <section className="rounded-lg border border-ink/10 bg-bone p-4">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink/60">{t("sales_title")}</h2>
              <Row label={t("sales_orders")} value={String(data.sales.orders)} />
              <Row label={t("sales_subtotal")} value={money(data.sales.subtotalCents)} />
              <Row label={t("sales_tax")} value={money(data.sales.taxCents)} />
              <Row label={t("sales_tips")} value={money(data.sales.tipCents)} />
              <Row label={t("sales_delivery")} value={money(data.sales.deliveryCents)} />
              <Row label={t("sales_discounts")} value={money(data.sales.discountCents)} />
              <Row label={t("sales_pending")} value={money(data.sales.pendingCents)} />
            </section>
          </>
        )}

        <section className="rounded-lg border border-ink/10 bg-bone p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">{t("history_title")}</h2>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink/60">{t("history_empty")}</p>
          ) : (
            <ul className="divide-y divide-ink/10 text-sm">
              {data.history.map((h) => (
                <li key={h.day} className="flex items-baseline gap-3 py-1.5">
                  <button type="button" onClick={() => goToDay(h.day)} className="tabular-nums underline">{h.day}</button>
                  <span className={`font-semibold tabular-nums ${diffClass(h.differenceCents)}`}>{money(h.differenceCents)}</span>
                  <span className="text-xs text-ink/50">{h.actor}</span>
                  <span className="ml-auto text-xs text-ink/50">{dateTimeFmt(h.updatedAt, activeLocale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
