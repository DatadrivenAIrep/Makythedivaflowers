"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PreferencePicker, type PickerValue } from "@/components/dates/PreferencePicker";
import { DAYS_IN_MONTH } from "@/lib/customer-dates";
import type { Locale } from "@/types/locale";

type Permission = "granted" | "stopped" | "none";
type Question =
  | { kind: "date"; recipientName: string; prefill: { month: number; day: number } | null }
  | { kind: "likes"; dateId: string; recipientName: string; prefill: PickerValue | null };
type Reward = { kind: "reward"; reward: string } | { kind: "stamp" } | null;
type Prompt = { question: Question; reward: Reward; permission: Permission };

type Props = { orderId: string; locale: Locale };

const EMPTY: PickerValue = { flowers: [], colors: [], avoid: [] };

/**
 * One question on the order confirmation: save an important date of the recipient
 * or, if they already have one, what they like. Renders nothing until the server
 * says there is a question to ask.
 */
export function DatePromptCard({ orderId, locale }: Props) {
  const t = useTranslations("date_prompt");
  const url = `/api/orders/${encodeURIComponent(orderId)}/date-prompt`;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [hidden, setHidden] = useState(false);
  const [kind, setKind] = useState<"birthday" | "anniversary">("birthday");
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [prefs, setPrefs] = useState<PickerValue>(EMPTY);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState<{ message: string; stamp: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as Prompt) : null))
      .catch(() => null)
      .then((p) => {
        if (!alive || !p) return;
        const q = p.question;
        if (q.kind === "date" && q.prefill) {
          setMonth(q.prefill.month);
          setDay(q.prefill.day);
        }
        if (q.kind === "likes" && q.prefill) setPrefs(q.prefill);
        setPrompt(p);
      });
    return () => { alive = false; };
  }, [url]);

  if (!prompt || hidden) return null;
  const { question, reward, permission } = prompt;

  async function post(body: unknown): Promise<{ permission: Permission; stamp: boolean } | null> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    const smsOptIn = permission === "none" && sms;
    const result = await post(
      question.kind === "date"
        ? { action: "date", kind, month, day, smsOptIn }
        : { action: "likes", ...prefs, smsOptIn },
    );
    setBusy(false);
    if (!result) { setError(true); return; }
    const message =
      question.kind === "likes" ? t("saved_likes") : result.permission === "granted" ? t("saved_sms") : t("saved_no_sms");
    // A stamp is only promised when a card was there to receive it at the time of asking.
    setSaved({ message, stamp: result.stamp && reward !== null });
  }

  async function dismiss() {
    setBusy(true);
    await post({ action: "dismiss" });
    setHidden(true);
  }

  const shell = "space-y-4 rounded-2xl border border-ink/10 bg-bone/40 p-6";

  if (saved) {
    return (
      <section className={shell} aria-live="polite">
        <p className="text-sm text-ink">{saved.message}</p>
        {saved.stamp && <p className="text-sm text-rouge">{t("saved_stamp")}</p>}
      </section>
    );
  }

  const name = question.recipientName;
  // Only flowers or colors earn the likes reward; "avoid" alone or nothing never does.
  const earnsLikes = prefs.flowers.length > 0 || prefs.colors.length > 0;
  const rewardLine =
    question.kind === "likes" && !earnsLikes
      ? null
      : reward === null
        ? t("promise")
        : reward.kind === "stamp"
          ? t("reward_stamp")
          : t(question.kind === "date" ? "reward_date" : "reward_likes", { reward: reward.reward });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long" });
  const maxDay = month ? DAYS_IN_MONTH[month - 1] : 31;
  const hasPrefs = prefs.flowers.length + prefs.colors.length + prefs.avoid.length > 0;
  const canSave = question.kind === "likes" ? hasPrefs : month > 0 && day > 0;
  const field = "rounded-lg border border-ink/20 bg-bone px-3 py-2 text-sm text-ink";

  return (
    <section className={shell}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {question.kind === "date" ? t("eyebrow") : t("likes_eyebrow", { name })}
      </p>
      <h2 className="font-display text-xl text-ink leading-tight">
        {question.kind === "date" ? t("date_title", { name }) : t("likes_title")}
      </h2>

      {question.kind === "date" ? (
        <div className="space-y-3">
          <div className="flex gap-2" role="group">
            {(["birthday", "anniversary"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  kind === k ? "border-ink bg-ink text-bone" : "border-ink/20 text-ink hover:border-ink/50"
                }`}
              >
                {t(`kind_${k}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              aria-label={t("month")}
              className={field}
              value={month || ""}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(m);
                if (day > DAYS_IN_MONTH[m - 1]) setDay(DAYS_IN_MONTH[m - 1]);
              }}
            >
              <option value="" disabled>{t("month")}</option>
              {DAYS_IN_MONTH.map((_, i) => (
                <option key={i} value={i + 1}>
                  {monthFmt.format(new Date(Date.UTC(2024, i, 1)))}
                </option>
              ))}
            </select>
            <select
              aria-label={t("day")}
              className={field}
              value={day || ""}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              <option value="" disabled>{t("day")}</option>
              {Array.from({ length: maxDay }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <PreferencePicker value={prefs} onChange={setPrefs} locale={locale} />
      )}

      {rewardLine && <p className="text-sm text-rouge">{rewardLine}</p>}

      {permission === "none" && (
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={sms} onChange={(e) => setSms(e.target.checked)} />
            <span>{t("consent_label")}</span>
          </label>
          <p className="text-[11px] leading-snug text-ink/55 max-w-[62ch]">{t("consent_fine")}</p>
        </div>
      )}
      {permission === "stopped" && <p className="text-sm text-ink/70">{t("stopped_note")}</p>}

      {error && <p role="alert" className="text-sm text-rouge">{t("error")}</p>}

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={save}
          className="rounded-full bg-rouge px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 hover:underline"
        >
          {t("dismiss")}
        </button>
      </div>
    </section>
  );
}
