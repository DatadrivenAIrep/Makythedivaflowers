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
import type { AccountDate } from "@/lib/account-dates";
import { FLOWERS } from "@/lib/date-preference-options";
import { PreferencePicker, type PickerValue } from "@/components/dates/PreferencePicker";
import type { Locale } from "@/types/locale";
import type { DateSuggestion } from "@/lib/date-suggestions";

type Props = {
  customerId: string;
  initial: Array<ImportantDate | AccountDate>;
  /** Date rewards flag: shows origin, likes and avoid, and lets staff edit them. */
  showPrefs?: boolean;
  locale: string;
  /** Yearly patterns found in the order history (lib/date-suggestions). */
  initialSuggestions?: DateSuggestion[];
  /** Lets the profile keep other sections (e.g. the recipients list) in sync. */
  onDatesChange?: (dates: AccountDate[]) => void;
};

const KIND_ICONS: Record<DateKind, typeof Cake> = {
  birthday: Cake,
  anniversary: Heart,
  custom: Star,
};
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const EMPTY_PREFS: PickerValue = { flowers: [], colors: [], avoid: [] };

export default function ImportantDates({ customerId, initial, locale, initialSuggestions = [], onDatesChange, showPrefs = false }: Props) {
  const t = useTranslations("admin_customers");
  const tp = useTranslations("date_prefs");
  const [dates, setDatesState] = useState<ImportantDate[]>(initial);
  // Server lists after add/remove carry no likes; keep what we know by date id.
  const [prefs, setPrefs] = useState<Record<string, PickerValue>>(() => {
    const m: Record<string, PickerValue> = {};
    for (const d of initial) if ("prefs" in d) m[d.id] = d.prefs;
    return m;
  });
  const [editing, setEditing] = useState<{ id: string; value: PickerValue } | null>(null);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>(initialSuggestions);
  function setDates(next: ImportantDate[]) {
    setDatesState(next);
    onDatesChange?.(next.map((d) => ({ ...d, prefs: prefs[d.id] ?? EMPTY_PREFS })));
  }
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

  async function resolveSuggestion(key: string, choice: "birthday" | "anniversary" | "dismiss") {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/date-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(choice === "dismiss" ? { action: "dismiss", key } : { action: "save", key, kind: choice }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as { dates: ImportantDate[]; dateSuggestions: DateSuggestion[] };
      setDates(out.dates);
      setSuggestions(out.dateSuggestions);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function savePrefs() {
    if (!editing) return;
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/dates/${editing.id}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing.value),
      });
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as { prefs: PickerValue };
      setPrefs((p) => ({ ...p, [editing.id]: out.prefs }));
      setEditing(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function codeLabel(c: string): string {
    return (FLOWERS as readonly string[]).includes(c) ? tp(`flowers.${c}`) : tp(`avoid.${c}`);
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
              <div key={d.id} className="rounded border border-ink/10 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Icon size={16} weight="bold" className="text-rouge" />
                <span className="font-semibold">{t(`date_kind_${d.kind}`)}</span>
                {showPrefs && (
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/70">
                    {d.source === "customer" ? t("date_source_customer") : t("date_source_panel")}
                  </span>
                )}
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
              {showPrefs && (() => {
                const p = prefs[d.id] ?? EMPTY_PREFS;
                const likes = [
                  ...p.flowers.map((c) => tp(`flowers.${c}`)),
                  ...p.colors.map((c) => tp(`colors.${c}`)),
                ];
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {likes.length > 0 && <span className="text-ink/70">{likes.join(", ")}</span>}
                    {p.avoid.length > 0 && (
                      <span className="font-semibold text-amber-800">
                        {t("date_prefs_avoid", { items: p.avoid.map(codeLabel).join(", ") })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing({ id: d.id, value: p })}
                      className="underline hover:text-ink"
                    >
                      {t("date_prefs_edit")}
                    </button>
                  </div>
                );
              })()}
              {showPrefs && editing?.id === d.id && (
                <div className="mt-2 rounded border border-ink/10 p-2">
                  <PreferencePicker
                    value={editing.value}
                    onChange={(value) => setEditing({ id: d.id, value })}
                    locale={locale as Locale}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void savePrefs()}
                      className="min-h-9 rounded-lg bg-rouge px-3 text-xs text-bone"
                    >
                      {t("date_prefs_save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-9 rounded-lg border border-ink/20 px-3 text-xs"
                    >
                      {t("date_prefs_cancel")}
                    </button>
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mb-3 rounded border border-rouge/30 bg-rouge/[0.04] p-2">
          <div className="mb-1.5 text-xs font-semibold text-rouge">{t("date_suggestions_title")}</div>
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-2 text-sm">
                <Star size={14} weight="bold" className="text-rouge" />
                <span className="flex-1 min-w-48">
                  {t("date_suggestion_text", {
                    name: s.recipientName,
                    date: formatMonthDay(s.month, s.day, locale),
                    years: s.years.join(", "),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => void resolveSuggestion(s.key, "birthday")}
                  className="min-h-9 rounded-lg border border-ink/20 px-2.5 text-xs hover:bg-ink/5"
                >
                  {t("date_suggestion_birthday")}
                </button>
                <button
                  type="button"
                  onClick={() => void resolveSuggestion(s.key, "anniversary")}
                  className="min-h-9 rounded-lg border border-ink/20 px-2.5 text-xs hover:bg-ink/5"
                >
                  {t("date_suggestion_anniversary")}
                </button>
                <button
                  type="button"
                  onClick={() => void resolveSuggestion(s.key, "dismiss")}
                  className="min-h-9 px-2 text-xs text-ink/50 underline hover:text-ink"
                >
                  {t("date_suggestion_dismiss")}
                </button>
              </li>
            ))}
          </ul>
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
