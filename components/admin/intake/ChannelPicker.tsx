"use client";
import { useTranslations } from "next-intl";
import type { MessagingChannel } from "@/types/order";

type Props = {
  value: MessagingChannel;
  onChange: (v: MessagingChannel) => void;
  emailAvailable: boolean;
};

const CHIPS: { id: MessagingChannel; key: string }[] = [
  { id: "sms", key: "channel_pref_sms" },
  { id: "whatsapp", key: "channel_pref_whatsapp" },
  { id: "email", key: "channel_pref_email" },
  { id: "none", key: "channel_pref_none" },
];

export default function ChannelPicker({ value, onChange, emailAvailable }: Props) {
  const t = useTranslations("admin_intake");
  return (
    <div className="mt-3">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">
        {t("channel_pref_label")}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => {
          const disabled = c.id === "email" && !emailAvailable;
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                disabled
                  ? "bg-mute-100 text-mute-300 cursor-not-allowed"
                  : active
                    ? "bg-ink text-bone"
                    : "bg-mute-100 text-mute-600 hover:bg-mute-200"
              }`}
              title={disabled ? t("channel_pref_email_disabled_hint") : undefined}
            >
              {t(c.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
