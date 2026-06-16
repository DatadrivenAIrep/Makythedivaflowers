"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { GearSix, Key, CheckCircle, WarningCircle, Eye, EyeSlash, Tag } from "@phosphor-icons/react/dist/ssr";

export default function SettingsPage() {
  const t = useTranslations("admin_settings");
  const locale = useLocale();
  const base = `/${locale}/admin/dashboard`;

  const [currentMasked, setCurrentMasked] = useState<string | null | undefined>(undefined);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setCurrentMasked(d.google_places_api_key ?? null))
      .catch(() => setCurrentMasked(null));
  }, []);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "google_places_api_key", value: keyInput }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setKeyInput("");
      // Re-fetch masked value
      const d = await fetch("/api/admin/settings").then((r) => r.json());
      setCurrentMasked(d.google_places_api_key ?? null);
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  async function removeKey() {
    setStatus("saving");
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "google_places_api_key", value: "" }),
      });
      setCurrentMasked(null);
      setStatus("idle");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <main className="max-w-[640px] mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={base} className="text-mute-500 hover:text-ink text-sm">{t("back")}</Link>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <GearSix size={24} weight="duotone" className="text-rouge" />
        <h1 className="font-display text-3xl text-ink">{t("title")}</h1>
      </div>

      {/* Catalog prices shortcut */}
      <section className="bg-white rounded-bento shadow-sm overflow-hidden mb-4">
        <Link
          href={`/${locale}/admin/products`}
          className="flex items-center justify-between px-6 py-4 hover:bg-bone transition group"
        >
          <div className="flex items-center gap-2">
            <Tag size={18} weight="duotone" className="text-rouge" />
            <span className="font-medium text-sm text-ink">{t("products_link")}</span>
          </div>
          <span className="text-mute-400 group-hover:text-ink transition">›</span>
        </Link>
      </section>

      <section className="bg-white rounded-bento shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-mute-100">
          <h2 className="font-display text-base text-ink">{t("section_integrations")}</h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Google Places API Key */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Key size={16} weight="bold" className="text-mute-500" />
              <label className="font-medium text-sm text-ink">{t("places_label")}</label>
            </div>
            <p className="text-sm text-mute-600 mb-3">{t("places_description")}</p>

            {/* Current status */}
            <div className={`mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${currentMasked ? "bg-green-50 text-green-800" : "bg-mute-100 text-mute-500"}`}>
              {currentMasked === undefined ? (
                <span className="animate-pulse">…</span>
              ) : currentMasked ? (
                <>
                  <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
                  <span>{t("places_current")} <code className="font-mono">{currentMasked}</code></span>
                  <button
                    type="button"
                    onClick={removeKey}
                    className="ml-auto text-mute-500 hover:text-rouge text-xs underline"
                  >{t("places_delete")}</button>
                </>
              ) : (
                <>
                  <WarningCircle size={16} weight="fill" className="text-mute-400 shrink-0" />
                  <span>{t("places_not_set")}</span>
                </>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={t("places_placeholder")}
                  autoComplete="off"
                  className="w-full p-3.5 pr-10 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-400 hover:text-ink"
                  aria-label={showKey ? "Ocultar" : "Mostrar"}
                >
                  {showKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                disabled={keyInput.trim().length < 10 || status === "saving"}
                onClick={save}
                className="px-5 py-3 rounded-xl bg-rouge text-bone text-sm font-display disabled:opacity-40 transition"
              >
                {status === "saving"
                  ? t("places_saving")
                  : status === "saved"
                  ? t("places_saved")
                  : status === "error"
                  ? t("places_error")
                  : t("places_save")}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <details className="text-sm text-mute-600">
            <summary className="cursor-pointer text-mute-500 hover:text-ink select-none">
              {t("places_instructions_title")}
            </summary>
            <ol className="mt-2 space-y-1 list-decimal pl-5">
              {t("places_instructions").split("\n").map((line, i) => (
                <li key={i}>{line.replace(/^\d+\.\s*/, "")}</li>
              ))}
            </ol>
          </details>
        </div>
      </section>
    </main>
  );
}
