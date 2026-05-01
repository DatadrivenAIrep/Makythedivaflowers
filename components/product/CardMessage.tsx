"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
};

function CardMessageImpl({ value, onChange, maxLength = 200 }: Props) {
  const t = useTranslations("product");
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {t("card_message_label")}
      </p>
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={t("card_message_placeholder")}
        className="w-full resize-none rounded-[var(--radius-product)] border border-ink/15 bg-transparent px-4 py-3 font-sans text-base leading-relaxed text-ink placeholder:text-mute-400 focus-visible:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
      />
      <p className="text-right font-mono text-xs text-mute-500">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

export const CardMessage = memo(CardMessageImpl);
