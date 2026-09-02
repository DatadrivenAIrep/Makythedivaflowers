"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import type { Locale } from "@/types/locale";

type Stage = "phone" | "code";

/**
 * Sign-in by SMS code. No password: a florist's customers order twice a year and
 * would reset a password every time, and the shop already has their number.
 */
export function SignInForm({ locale }: { locale: Locale }) {
  const t = useTranslations("account.sign_in_sms");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.status === 429) {
        setError(t("error_rate_limited"));
        return;
      }
      if (!res.ok) {
        setError(t("error_phone"));
        return;
      }
      // Deliberately the same next step whether or not the number is on file:
      // the page never reveals who has an account here.
      setStage("code");
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error === "rate_limited" || data?.error === "too_many_attempts"
            ? t("error_too_many")
            : data?.error === "expired"
              ? t("error_expired")
              : t("error_code"),
        );
        return;
      }
      router.replace(`/${locale}/account/orders`);
      router.refresh();
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-6">
        <p className="text-sm leading-relaxed text-ink/75">{t("code_sent", { phone })}</p>
        <FormField label={t("code_label")} htmlFor="acct-code" required>
          <TextInput
            id="acct-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        {error && (
          <p role="alert" className="font-mono text-[11px] text-error">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4">
          <FormSubmit disabled={busy || code.length !== 6}>{t("submit_code")}</FormSubmit>
          <button
            type="button"
            onClick={() => {
              setStage("phone");
              setCode("");
              setError(null);
            }}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
          >
            {t("change_number")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-6">
      <p className="text-sm leading-relaxed text-ink/75">{t("intro")}</p>
      <FormField label={t("phone_label")} htmlFor="acct-phone" required>
        <TextInput
          id="acct-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>
      {error && (
        <p role="alert" className="font-mono text-[11px] text-error">
          {error}
        </p>
      )}
      <FormSubmit disabled={busy}>{t("submit_phone")}</FormSubmit>
    </form>
  );
}
