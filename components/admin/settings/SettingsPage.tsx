"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { GearSix, Tag } from "@phosphor-icons/react/dist/ssr";
import SecretField from "./SecretField";
import TwilioSettings from "./TwilioSettings";

export default function SettingsPage() {
  const t = useTranslations("admin_settings");
  const locale = useLocale();
  const base = `/${locale}/admin/dashboard`;

  const [currentMasked, setCurrentMasked] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setCurrentMasked(d.google_places_api_key ?? null))
      .catch(() => setCurrentMasked(null));
  }, []);

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
          <SecretField
            label={t("places_label")}
            description={t("places_description")}
            placeholder={t("places_placeholder")}
            currentMasked={currentMasked}
            labels={{
              current: t("places_current"),
              notSet: t("places_not_set"),
              save: t("places_save"),
              saving: t("places_saving"),
              saved: t("places_saved"),
              error: t("places_error"),
              delete: t("places_delete"),
            }}
            onSave={async (v) => {
              const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "google_places_api_key", value: v }),
              });
              if (!res.ok) throw new Error("save_failed");
              const d = await fetch("/api/admin/settings").then((r) => r.json());
              setCurrentMasked(d.google_places_api_key ?? null);
            }}
            onDelete={async () => {
              await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "google_places_api_key", value: "" }),
              });
              setCurrentMasked(null);
            }}
          />

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

      <TwilioSettings />
    </main>
  );
}
