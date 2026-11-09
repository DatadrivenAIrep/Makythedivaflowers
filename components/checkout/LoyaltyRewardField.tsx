"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LoyaltyReward } from "@/lib/loyalty-rewards";
import type { Locale } from "@/types/locale";

export type AppliedLoyaltyReward = { id: string; percent: number; label: string; proof: string };
export type LoyaltyStatus = "unavailable" | "no_card" | "card";

type Props = {
  phone: string;
  locale: Locale;
  applied: AppliedLoyaltyReward | null;
  onApply: (r: AppliedLoyaltyReward) => void;
  onClear: () => void;
  onStatus: (s: LoyaltyStatus) => void;
};

const MIN_DIGITS = 10;
const LOOKUP_DELAY_MS = 400;

function highest(rewards: LoyaltyReward[]): LoyaltyReward | null {
  return rewards.reduce<LoyaltyReward | null>(
    (best, r) => (best === null || r.percent > best.percent ? r : best),
    null,
  );
}

async function post(url: string, body: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export function LoyaltyRewardField({ phone, locale, applied, onApply, onClear, onStatus }: Props) {
  const t = useTranslations("checkout");
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "code">("pick");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Latest callbacks and applied state, read inside the lookup effect without
  // making it re-run when the parent re-renders.
  const latest = useRef({ applied, onClear, onStatus });
  latest.current = { applied, onClear, onStatus };

  // The field unmounts when the contact step collapses and mounts again when it
  // reopens; only a real change of number may drop the applied reward.
  const lastPhone = useRef(phone);

  const digits = phone.replace(/\D/g, "");
  const ready = digits.length >= MIN_DIGITS;

  // Any phone change drops the reward and every piece of state tied to the old
  // number, then looks the new one up after a short pause.
  useEffect(() => {
    setRewards([]);
    setSelectedId(null);
    setStep("pick");
    setCode("");
    setError(null);
    if (lastPhone.current !== phone && latest.current.applied) latest.current.onClear();
    lastPhone.current = phone;
    if (!ready) {
      latest.current.onStatus("unavailable");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await post("/api/checkout/loyalty/lookup", { phone });
        if (cancelled) return;
        if (data?.status === "card" && Array.isArray(data.rewards) && data.rewards.length > 0) {
          const list = data.rewards as LoyaltyReward[];
          setRewards(list);
          setSelectedId(highest(list)?.id ?? null);
          latest.current.onStatus("card");
        } else if (data?.status === "no_card") {
          latest.current.onStatus("no_card");
        } else {
          latest.current.onStatus("unavailable");
        }
      } catch {
        // The program is optional: a failed lookup leaves checkout as it was.
        if (!cancelled) latest.current.onStatus("unavailable");
      }
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function sendCode() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const { status, data } = await post("/api/checkout/loyalty/send-code", { phone, locale });
      if (status === 429 || data?.reason === "rate_limited") {
        setError(t("loyalty_rate_limited"));
        return;
      }
      if (!data?.sent) {
        setError(t("loyalty_unavailable"));
        return;
      }
      setStep("code");
    } catch {
      setError(t("loyalty_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const trimmed = code.trim();
    if (!trimmed || !selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await post("/api/checkout/loyalty/verify", { phone, code: trimmed });
      if (data?.reason === "wrong") {
        setError(t("loyalty_wrong_code"));
        return;
      }
      if (data?.reason === "expired") {
        setError(t("loyalty_expired_code"));
        return;
      }
      if (typeof data?.proof !== "string" || !Array.isArray(data.rewards)) {
        setError(t("loyalty_unavailable"));
        return;
      }
      const fresh = data.rewards as LoyaltyReward[];
      const chosen = fresh.find((r) => r.id === selectedId);
      if (!chosen) {
        // The reward was spent meanwhile. Show what is still available and make
        // the buyer choose again; never apply a different reward silently.
        setRewards(fresh);
        setSelectedId(highest(fresh)?.id ?? null);
        setStep("pick");
        setCode("");
        setError(t("loyalty_unavailable"));
        return;
      }
      setStep("pick");
      setCode("");
      onApply({ id: chosen.id, percent: chosen.percent, label: chosen.label, proof: data.proof });
    } catch {
      setError(t("loyalty_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-bone/60 px-3 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/80">
          {t("loyalty_applied")}
          <span className="ml-2 text-rouge">{applied.label}</span>
        </p>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
        >
          {t("loyalty_remove")}
        </button>
      </div>
    );
  }

  if (rewards.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-ink/10 bg-bone/60 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {t("loyalty_has_reward")}
      </p>
      {step === "pick" ? (
        <>
          <div role="radiogroup" className="space-y-2">
            {rewards.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                <input
                  type="radio"
                  name="loyalty-reward"
                  className="h-4 w-4 accent-rouge"
                  checked={selectedId === r.id}
                  onChange={() => setSelectedId(r.id)}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink/60">{t("loyalty_send_code")}</p>
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy || !selectedId}
            className="rounded-lg border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-50"
          >
            {t("loyalty_use")}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor="loyalty-code"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500"
          >
            {t("loyalty_code_label")}
          </label>
          <div className="flex gap-2">
            <input
              id="loyalty-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Inside the checkout form: Enter confirms the code, not the order.
                  e.preventDefault();
                  void confirm();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm tracking-widest text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/50"
            />
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="shrink-0 rounded-lg border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-50"
            >
              {t("loyalty_confirm")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="font-mono text-[11px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default LoyaltyRewardField;
