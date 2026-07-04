"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import type { PreferenceKind } from "@/lib/customer-dates";
import type { PreferencesMap } from "@/lib/customer-dates-storage";

type Props = { customerId: string; initial: PreferencesMap; suggestions: PreferencesMap };

const GROUPS: Array<{ kind: PreferenceKind; labelKey: string; chipClass: string }> = [
  { kind: "favorite_flower", labelKey: "pref_favorite_flower", chipClass: "bg-ink/5 text-ink/70" },
  { kind: "favorite_color", labelKey: "pref_favorite_color", chipClass: "bg-ink/5 text-ink/70" },
  { kind: "dislike", labelKey: "pref_dislike", chipClass: "bg-rose-50 text-rose-800" },
];

export default function PreferenceChips({ customerId, initial, suggestions }: Props) {
  const t = useTranslations("admin_customers");
  const [prefs, setPrefs] = useState<PreferencesMap>(initial);
  const [drafts, setDrafts] = useState<Record<PreferenceKind, string>>({
    favorite_flower: "",
    favorite_color: "",
    dislike: "",
  });
  const [error, setError] = useState(false);

  async function mutate(method: "POST" | "DELETE", kind: PreferenceKind, value: string) {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/preferences`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPrefs(((await res.json()) as { preferences: PreferencesMap }).preferences);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <section className="mb-3 rounded border border-ink/10 bg-bone p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("prefs_section")}</div>
      {error && (
        <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-800">{t("error_load")}</div>
      )}
      <div className="flex flex-col gap-2">
        {GROUPS.map((g) => (
          <div key={g.kind} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-40 text-xs uppercase tracking-wide text-ink/50">{t(g.labelKey)}</span>
            {prefs[g.kind].map((v) => (
              <span
                key={v}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${g.chipClass}`}
              >
                {v}
                <button
                  type="button"
                  aria-label={`${t(g.labelKey)}: ${v} ×`}
                  onClick={() => void mutate("DELETE", g.kind, v)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X size={12} weight="bold" />
                </button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = drafts[g.kind].trim();
                if (v) {
                  void mutate("POST", g.kind, v);
                  setDrafts((d) => ({ ...d, [g.kind]: "" }));
                }
              }}
              className="flex items-center gap-1"
            >
              <input
                value={drafts[g.kind]}
                onChange={(e) => setDrafts((d) => ({ ...d, [g.kind]: e.target.value }))}
                placeholder={t("pref_placeholder")}
                list={`pref-suggest-${g.kind}`}
                className="h-8 rounded border border-ink/20 bg-bone px-2 text-xs"
              />
              <datalist id={`pref-suggest-${g.kind}`}>
                {suggestions[g.kind].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="submit"
                className="flex h-8 items-center gap-1 rounded border border-ink/20 px-2 text-xs hover:bg-ink/5"
              >
                <Plus size={12} weight="bold" /> {t("pref_add")}
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
