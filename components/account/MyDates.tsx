"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PreferencePicker, type PickerValue } from "@/components/dates/PreferencePicker";
import { DAYS_IN_MONTH, formatMonthDay } from "@/lib/customer-dates";
import { flowersPhrase } from "@/lib/date-preference-options";
import type { Locale } from "@/types/locale";

type Permission = "granted" | "stopped" | "none";
type Kind = "birthday" | "anniversary";

// Plain shapes of what GET /api/account/dates returns (server modules are not importable here).
export type MyDate = {
  id: string;
  kind: string;
  label?: string;
  month: number;
  day: number;
  prefs: PickerValue;
  source?: "admin" | "customer" | "card";
  relationship?: string;
};
export type MySuggestion = { key: string; recipientName: string; month: number; day: number };
export type MyDatesView = { dates: MyDate[]; suggestions: MySuggestion[]; permission: Permission };

type Props = { locale: Locale; initial: MyDatesView };

const field = "rounded-lg border border-ink/20 bg-bone px-3 py-2 text-sm text-ink";
const pill =
  "rounded-full bg-rouge px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone disabled:opacity-50";
const quiet = "font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 hover:underline disabled:opacity-50";

export function MyDates({ locale, initial }: Props) {
  const t = useTranslations("account.dates");
  const prompt = useTranslations("date_prompt");
  const cardT = useTranslations("card_dates");

  const [view, setView] = useState<MyDatesView>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [smsOffNote, setSmsOffNote] = useState(false);

  const [kind, setKind] = useState<Kind>("birthday");
  const [name, setName] = useState("");
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [suggestionKinds, setSuggestionKinds] = useState<Record<string, Kind>>({});

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<PickerValue>({ flowers: [], colors: [], avoid: [] });
  const [sms, setSms] = useState(false);

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long" });
  const maxDay = month ? DAYS_IN_MONTH[month - 1] : 31;

  async function refresh() {
    try {
      const res = await fetch("/api/account/dates", { cache: "no-store" });
      if (res.ok) setView((await res.json()) as MyDatesView);
    } catch {
      /* keep what is on screen */
    }
  }

  async function send(url: string, method: string, body?: unknown): Promise<Response | null> {
    try {
      return await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return null;
    }
  }

  function failure(res: Response | null, body: { error?: string } | null) {
    if (res?.status === 409 && body?.error === "too_many_dates") {
      setError(t("error_too_many", { max: 12 })); // keep in step with MAX_DATES (server-only module)
    } else if (res?.status === 400) setError(t("error_invalid"));
    else setError(t("error"));
  }

  async function add(input: { kind: Kind; name: string; month: number; day: number }): Promise<boolean> {
    setError(null);
    setBusy(true);
    const res = await send("/api/account/dates", "POST", { action: "add", ...input });
    const body = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    setBusy(false);
    if (!res?.ok) { failure(res, body); return false; }
    await refresh();
    return true;
  }

  async function submitAdd() {
    if (busy) return;
    if (await add({ kind, name, month, day })) {
      setName("");
      setMonth(0);
      setDay(0);
    }
  }

  // Immediate and without a confirmation step: the date disappears at once.
  async function remove(id: string) {
    setError(null);
    setView((v) => ({ ...v, dates: v.dates.filter((d) => d.id !== id) }));
    if (editing === id) setEditing(null);
    const res = await send(`/api/account/dates/${encodeURIComponent(id)}`, "DELETE");
    if (!res?.ok && res?.status !== 404) {
      setError(t("error"));
      await refresh();
    }
  }

  async function saveLikes(id: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await send(`/api/account/dates/${encodeURIComponent(id)}`, "PUT", draft);
    setBusy(false);
    if (!res?.ok) { setError(t("error")); return; }
    setEditing(null);
    await refresh();
  }

  async function dismissSuggestion(key: string) {
    setError(null);
    setView((v) => ({ ...v, suggestions: v.suggestions.filter((s) => s.key !== key) }));
    const res = await send("/api/account/dates", "POST", { action: "dismiss_suggestion", key });
    if (!res?.ok) setError(t("error"));
  }

  async function saveSuggestion(s: MySuggestion) {
    if (busy) return;
    const ok = await add({
      kind: suggestionKinds[s.key] ?? "birthday",
      name: s.recipientName,
      month: s.month,
      day: s.day,
    });
    if (ok) await dismissSuggestion(s.key);
  }

  async function setPermission(grant: boolean) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await send("/api/account/sms-permission", "POST", { grant });
    const body = res ? ((await res.json().catch(() => null)) as { permission?: Permission } | null) : null;
    setBusy(false);
    if (!body?.permission) { setError(t("error")); return; }
    setView((v) => ({ ...v, permission: body.permission as Permission }));
    setSmsOffNote(!grant && body.permission !== "granted");
    if (grant) setSms(false);
  }

  function startEditing(d: MyDate) {
    setEditing(d.id);
    setDraft({ flowers: [...d.prefs.flowers], colors: [...d.prefs.colors], avoid: [...d.prefs.avoid] });
  }

  const kindButtons = (value: Kind, onPick: (k: Kind) => void) => (
    <div className="flex gap-2" role="group">
      {(["birthday", "anniversary"] as const).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onPick(k)}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            value === k ? "border-ink bg-ink text-bone" : "border-ink/20 text-ink hover:border-ink/50"
          }`}
        >
          {prompt(`kind_${k}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-3xl text-ink leading-tight">{t("title")}</h2>
        <p className="mt-2 text-sm text-ink/70 max-w-[60ch]">{t("intro")}</p>
      </div>

      {error && <p role="alert" className="text-sm text-rouge">{error}</p>}

      <section aria-label={t("list_label")}>
        {view.dates.length === 0 ? (
          <p className="text-sm text-ink/60">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {view.dates.map((d) => {
              const phrase = flowersPhrase(d.prefs.flowers[0], d.prefs.colors[0], locale);
              const hasAny = d.prefs.flowers.length + d.prefs.colors.length + d.prefs.avoid.length > 0;
              const who = d.label ?? (d.source === "card" && d.relationship ? cardT(`relationship.${d.relationship}`) : "");
              return (
                <li key={d.id} className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-ink">{who}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
                        {d.kind === "anniversary" ? prompt("kind_anniversary") : prompt("kind_birthday")}
                        {" · "}
                        {formatMonthDay(d.month, d.day, locale)}
                      </p>
                      {d.source === "card" && <p className="mt-1 text-sm text-ink/60">{t("from_card")}</p>}
                      {phrase && <p className="mt-1 text-sm text-ink/70">{t("likes_line", { likes: phrase })}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={t("delete_label", { name: who })}
                      onClick={() => remove(d.id)}
                      className={quiet}
                    >
                      {t("delete")}
                    </button>
                  </div>

                  {editing === d.id ? (
                    <div className="space-y-4 rounded-2xl border border-ink/10 bg-bone/40 p-4">
                      <PreferencePicker value={draft} onChange={setDraft} locale={locale} />
                      <div className="flex items-center gap-4">
                        <button type="button" disabled={busy} onClick={() => saveLikes(d.id)} className={pill}>
                          {t("save_likes")}
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className={quiet}>
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startEditing(d)} className={quiet}>
                      {hasAny ? t("edit_likes") : t("add_likes")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {view.suggestions.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">{t("suggestions_title")}</h3>
          <ul className="space-y-4">
            {view.suggestions.map((s) => (
              <li key={s.key} className="space-y-2 rounded-2xl border border-ink/10 bg-bone/40 p-4">
                <p className="text-sm text-ink">
                  {t("suggestion_line", { name: s.recipientName, date: formatMonthDay(s.month, s.day, locale) })}
                </p>
                {kindButtons(suggestionKinds[s.key] ?? "birthday", (k) =>
                  setSuggestionKinds((m) => ({ ...m, [s.key]: k })),
                )}
                <div className="flex items-center gap-4">
                  <button type="button" disabled={busy} onClick={() => saveSuggestion(s)} className={pill}>
                    {t("suggestion_save")}
                  </button>
                  <button type="button" onClick={() => dismissSuggestion(s.key)} className={quiet}>
                    {t("suggestion_dismiss")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">{t("add_title")}</h3>
        {kindButtons(kind, setKind)}
        <label className="block space-y-1">
          <span className="text-sm text-ink">{t("name_label")}</span>
          <input
            className={`${field} w-full`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="block text-[11px] text-ink/55">{t("name_hint")}</span>
        </label>
        <div className="flex gap-2">
          <select
            aria-label={prompt("month")}
            className={field}
            value={month || ""}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMonth(m);
              if (day > DAYS_IN_MONTH[m - 1]) setDay(DAYS_IN_MONTH[m - 1]);
            }}
          >
            <option value="" disabled>{prompt("month")}</option>
            {DAYS_IN_MONTH.map((_, i) => (
              <option key={i} value={i + 1}>{monthFmt.format(new Date(Date.UTC(2024, i, 1)))}</option>
            ))}
          </select>
          <select
            aria-label={prompt("day")}
            className={field}
            value={day || ""}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            <option value="" disabled>{prompt("day")}</option>
            {Array.from({ length: maxDay }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || name.trim() === "" || month === 0 || day === 0}
          onClick={submitAdd}
          className={pill}
        >
          {t("add")}
        </button>
      </section>

      <section className="space-y-2 border-t border-ink/10 pt-6">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">{t("sms_title")}</h3>
        {view.permission === "granted" && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink">{t("sms_on")}</p>
            <button type="button" disabled={busy} onClick={() => setPermission(false)} className={quiet}>
              {t("sms_remove")}
            </button>
          </div>
        )}
        {view.permission === "none" && (
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={sms}
                disabled={busy}
                onChange={(e) => {
                  setSms(e.target.checked);
                  if (e.target.checked) void setPermission(true);
                }}
              />
              <span>{prompt("consent_label")}</span>
            </label>
            <p className="text-[11px] leading-snug text-ink/55 max-w-[62ch]">{prompt("consent_fine")}</p>
            {smsOffNote && <p className="text-sm text-ink/70">{t("sms_off_note")}</p>}
          </div>
        )}
        {view.permission === "stopped" && <p className="text-sm text-ink/70">{prompt("stopped_note")}</p>}
      </section>
    </div>
  );
}
