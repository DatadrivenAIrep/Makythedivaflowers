"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Cake, Heart, Plus, Star, X } from "@phosphor-icons/react/dist/ssr";
import {
  DAYS_IN_MONTH,
  formatMonthDay,
  isValidMonthDay,
  type DateKind,
} from "@/lib/customer-dates";
import type { ImportantDate } from "@/lib/customer-dates-storage";

type Props = { customerId: string; initial: ImportantDate[]; locale: string };

const KIND_ICONS: Record<DateKind, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  custom: Star,
};
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ImportantDates({ customerId, initial, locale }: Props) {
  const t = useTranslations("admin_customers");
  const [dates, setDates] = useState<ImportantDate[]>(initial);
  const [kind, setKind] = useState<DateKind>("birthday");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function monthName(m: number): string {
    return new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString(
      locale === "es" ? "es-ES" : "en-US",
      { month: "long", timeZone: "UTC" },
    );
  }

  function onMonthChange(m: number) {
    setMonth(m);
    const max = DAYS_IN_MONTH[m - 1];
    if (day > max) setDay(max);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidMonthDay(month, day)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          month,
          day,
          year: year ? Number(year) : undefined,
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDates(((await res.json()) as { dates: ImportantDate[] }).dates);
      setLabel("");
      setYear("");
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/dates`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDates(((await res.json()) as { dates: ImportantDate[] }).dates);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("dates_section")}</div>
      {error && (
        <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-800">{t("error_load")}</div>
      )}
      {dates.length === 0 ? (
        <div className="mb-2 text-sm text-ink/50">{t("no_dates")}</div>
      ) : (
        <div className="mb-2 flex flex-col gap-1">
          {dates.map((d) => {
            const Icon = KIND_ICONS[d.kind];
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded border border-ink/10 px-3 py-2 text-sm"
              >
                <Icon size={16} weight="bold" className="text-rouge" />
                <span className="font-semibold">{t(`date_kind_${d.kind}`)}</span>
                {d.label && <span className="text-ink/70">· {d.label}</span>}
                <span className="text-ink/70">
                  · {formatMonthDay(d.month, d.day, locale)}
                  {d.year ? ` · ${d.year}` : ""}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.next.daysUntil === 0 ? "bg-rouge text-bone" : "bg-ink/5 text-ink/70"
                  }`}
                >
                  {d.next.daysUntil === 0 ? t("date_today") : t("date_in_days", { days: d.next.daysUntil })}
                </span>
                <button
                  type="button"
                  aria-label={t("date_remove")}
                  onClick={() => void remove(d.id)}
                  className="text-ink/40 hover:text-ink"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DateKind)}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          <option value="birthday">{t("date_kind_birthday")}</option>
          <option value="anniversary">{t("date_kind_anniversary")}</option>
          <option value="custom">{t("date_kind_custom")}</option>
        </select>
        <select
          value={month}
          aria-label={t("date_month")}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{monthName(m)}</option>
          ))}
        </select>
        <select
          value={day}
          aria-label={t("date_day")}
          onChange={(e) => setDay(Number(e.target.value))}
          className="min-h-11 rounded-lg border border-ink/20 bg-bone px-2"
        >
          {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t("date_year")}
          inputMode="numeric"
          className="min-h-11 w-28 rounded-lg border border-ink/20 bg-bone px-2"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("date_label_placeholder")}
          className="min-h-11 min-w-40 flex-1 rounded-lg border border-ink/20 bg-bone px-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-ink/20 px-3 hover:bg-ink/5 disabled:opacity-50"
        >
          <Plus size={14} weight="bold" /> {t("date_add")}
        </button>
      </form>
    </section>
  );
}
