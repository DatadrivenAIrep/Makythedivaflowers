"use client";
import { useTranslations } from "next-intl";

export type MessageLocale = "en" | "es";

// Language names stay in their own language, so they read right from either UI.
export const LANGUAGE_CHIPS: { id: MessageLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

type Props = { value: MessageLocale; onChange: (v: MessageLocale) => void };

/** Which language the automatic texts and emails go out in for this customer. */
export default function LanguagePicker({ value, onChange }: Props) {
  const t = useTranslations("admin_intake");
  return (
    <div className="mt-3">
      <div id="intake-language-label" className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">
        {t("language_label")}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="intake-language-label">
        {LANGUAGE_CHIPS.map((c) => {
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                active ? "bg-ink text-bone" : "bg-mute-100 text-mute-600 hover:bg-mute-200"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
