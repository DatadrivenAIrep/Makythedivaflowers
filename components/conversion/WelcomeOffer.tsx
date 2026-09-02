"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";

const STORAGE_KEY = "diva_welcome_offer_seen";
const SHOW_AFTER_MS = 8000;
/** Once a month at most, whether they took it or dismissed it. */
const QUIET_DAYS = 30;

/** Never interrupt someone who is already buying, or a member of staff. */
const NEVER_ON = [/\/checkout/, /\/cart/, /\/order\//, /\/admin/, /\/account/];

function quietUntilPassed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    return Date.now() > Number(raw) + QUIET_DAYS * 86400_000;
  } catch {
    // A browser that blocks storage should still see the site, just not the
    // popup — the safer default is silence, not repetition on every page.
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* storage blocked; the popup simply reappears next session */
  }
}

export function WelcomeOffer({ locale }: { locale: Locale }) {
  const t = useTranslations("conversion.welcome");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"form" | "sent">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blocked = NEVER_ON.some((re) => re.test(pathname));

  useEffect(() => {
    if (blocked || !quietUntilPassed()) return;
    const id = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [blocked]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    markSeen();
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, locale, marketingConsent: consent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error === "rate_limited" ? t("error_rate_limited") : t("error_phone"));
        return;
      }
      markSeen();
      setState("sent");
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t("close")}
        onClick={close}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-bone p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="absolute right-4 top-4 p-1 text-ink/50 transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {state === "sent" ? (
          <div role="status">
            <h2 id="welcome-title" className="font-display text-2xl tracking-tight text-ink">
              {t("sent_title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/75">{t("sent_body")}</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
              {t("eyebrow")}
            </p>
            <h2
              id="welcome-title"
              className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink"
            >
              {t("title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/75">{t("body")}</p>

            <label className="mt-5 block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
                {t("phone_label")}
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-ink/15 bg-bone px-3 py-2 text-sm text-ink"
              />
            </label>

            <label className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-ink/75">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>{t("consent")}</span>
            </label>

            {error && (
              <p role="alert" className="mt-3 font-mono text-[11px] text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-12 w-full rounded-full bg-rouge font-sans text-sm font-medium text-bone transition hover:opacity-90 disabled:opacity-50"
            >
              {t("submit")}
            </button>
            <button
              type="button"
              onClick={close}
              className="mt-3 block w-full text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink/70"
            >
              {t("dismiss")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
