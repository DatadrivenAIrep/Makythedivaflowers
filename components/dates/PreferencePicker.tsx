"use client";
import { useTranslations } from "next-intl";
import { AVOID, COLORS, FLOWERS } from "@/lib/date-preference-options";
import type { AvoidCode, ColorCode, FlowerCode } from "@/lib/date-preference-options";
import type { Locale } from "@/types/locale";

// Same shape as DatePreferences in the server storage module (not importable here).
export type PickerValue = { flowers: FlowerCode[]; colors: ColorCode[]; avoid: AvoidCode[] };

type Props = {
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  locale: Locale;
};

const MAX_PICKS = 3;

function toggle<T extends string>(list: readonly T[], code: T, max?: number): T[] {
  if (list.includes(code)) return list.filter((c) => c !== code);
  if (max !== undefined && list.length >= max) return [...list];
  return [...list, code];
}

/** Fixed-list buttons for what a person likes: 3 flowers, 3 colors, "avoid" uncapped. */
export function PreferencePicker({ value, onChange }: Props) {
  const t = useTranslations("date_prompt");
  const labels = useTranslations("date_prefs");

  const flowerLabel = (c: FlowerCode) => labels(`flowers.${c}`);
  const avoidLabel = (c: AvoidCode) =>
    (FLOWERS as readonly string[]).includes(c) ? labels(`flowers.${c}`) : labels(`avoid.${c}`);

  return (
    <div className="space-y-5">
      <Group label={t("flowers_label")}>
        {FLOWERS.map((c) => (
          <Chip
            key={c}
            label={flowerLabel(c)}
            on={value.flowers.includes(c)}
            full={value.flowers.length >= MAX_PICKS}
            onClick={() => onChange({ ...value, flowers: toggle(value.flowers, c, MAX_PICKS) })}
          />
        ))}
      </Group>
      <Group label={t("colors_label")}>
        {COLORS.map((c) => (
          <Chip
            key={c}
            label={labels(`colors.${c}`)}
            on={value.colors.includes(c)}
            full={value.colors.length >= MAX_PICKS}
            onClick={() => onChange({ ...value, colors: toggle(value.colors, c, MAX_PICKS) })}
          />
        ))}
      </Group>
      <Group label={t("avoid_label")}>
        {AVOID.map((c) => (
          <Chip
            key={c}
            label={avoidLabel(c)}
            on={value.avoid.includes(c)}
            full={false}
            onClick={() => onChange({ ...value, avoid: toggle(value.avoid, c) })}
          />
        ))}
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ label, on, full, onClick }: { label: string; on: boolean; full: boolean; onClick: () => void }) {
  const blocked = full && !on;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={blocked}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-ink bg-ink text-bone"
          : "border-ink/20 text-ink hover:border-ink/50 disabled:opacity-40 disabled:hover:border-ink/20"
      }`}
    >
      {label}
    </button>
  );
}
