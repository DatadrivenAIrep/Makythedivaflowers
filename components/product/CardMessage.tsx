"use client";
import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import type { Occasion } from "@/schemas/card-message";
import { CardMessageAssist } from "./CardMessageAssist";
import { getRelations } from "@/lib/card-message-relations";
import { FormField } from "@/components/ui/form/FormField";
import { TextArea } from "@/components/ui/form/TextArea";

type Props = {
  locale: Locale;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  productTitle: string;
  occasions: string[];
};

function CardMessageImpl({
  locale,
  value,
  onChange,
  maxLength = 200,
  productTitle,
  occasions,
}: Props) {
  const t = useTranslations("card_message_assist");
  const [open, setOpen] = useState(false);

  const isSympathy = occasions.includes("sympathy");
  const mode = isSympathy ? "sympathy" : "default";
  const occasion = (isSympathy ? "sympathy" : (occasions[0] as Occasion | undefined)) ?? "just-because";
  const relations = getRelations(mode, locale);

  const copy = {
    title: t("title"),
    generate: isSympathy ? t("generate_sympathy") : t("generate"),
    regenerate: t("regenerate"),
    retry: t("retry"),
    close: t("close"),
    errorGeneric: t("error_generic"),
    errorRateLimit: t("error_rate_limit"),
  };

  const triggerLabel = isSympathy ? t("trigger_sympathy") : t("trigger");
  const triggerPrefix = isSympathy ? "" : "✨ ";

  const label = locale === "es" ? "Mensaje de tarjeta (opcional)" : "Card message (optional)";
  const placeholder = locale === "es" ? "Para alguien especial…" : "For someone special…";

  return (
    <div className="flex flex-col gap-2">
      {open && (
        <CardMessageAssist
          productTitle={productTitle}
          occasion={occasion as Occasion}
          locale={locale}
          relations={relations}
          copy={copy}
          onPick={(text) => {
            onChange(text.slice(0, maxLength));
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}

      <FormField label={label} htmlFor="card-message">
        <TextArea
          id="card-message"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
        />
      </FormField>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-xs text-mute-500 hover:text-ink"
        >
          {triggerPrefix}
          {triggerLabel}
        </button>
        <p className="font-mono text-xs text-mute-500">
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}

export const CardMessage = memo(CardMessageImpl);
