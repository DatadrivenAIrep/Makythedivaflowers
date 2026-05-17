"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function AdminLoginPage() {
  const t = useTranslations("admin_login");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? `/${locale}/admin/intake`;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next);
        return;
      }
      setError(res.status === 401 ? t("error_invalid") : t("error_network"));
    } catch {
      setError(t("error_network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bone px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-ink mb-2">{t("brand")}</h1>
        <p className="text-mute-500 text-sm mb-8">{t("subtitle")}</p>
        <label className="block text-xs uppercase tracking-widest text-mute-400 mb-2">{t("password_label")}</label>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 rounded-xl bg-bone border border-mute-200 text-ink text-lg outline-none focus:border-ink"
          inputMode="text"
          autoComplete="current-password"
        />
        {error && <p className="text-error text-sm mt-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-6 w-full py-4 rounded-full bg-ink text-bone font-display text-lg disabled:opacity-40"
        >
          {busy ? t("submitting") : t("submit")}
        </button>
      </form>
    </main>
  );
}
