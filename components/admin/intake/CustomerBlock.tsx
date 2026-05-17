"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Address } from "@/types/address";
import type { MessagingChannel } from "@/types/order";
import ChannelPicker from "./ChannelPicker";

export type CustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
  messagingChannel: MessagingChannel;
};

type Props = {
  value: CustomerSnapshot;
  onChange: (v: CustomerSnapshot) => void;
  onApplyAddress: (address: Address) => void;
};

export default function CustomerBlock({ value, onChange, onApplyAddress }: Props) {
  const t = useTranslations("admin_intake");
  const [match, setMatch] = useState<{ orderCount: number; lastCity?: string; lastAddress?: Address; messagingChannel?: MessagingChannel } | null>(null);

  useEffect(() => {
    const digits = value.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setMatch(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(digits)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.found) {
          setMatch(null);
          return;
        }
        const c = data.customer;
        setMatch({
          orderCount: c.orderCount,
          lastCity: c.lastAddress?.city,
          lastAddress: c.lastAddress,
          messagingChannel: c.messagingChannel,
        });
        onChange({
          ...value,
          name: value.name || c.name,
          email: value.email || c.email || "",
          // Adopt the saved channel only if user is still on default.
          messagingChannel:
            value.messagingChannel === "sms" && c.messagingChannel
              ? c.messagingChannel
              : value.messagingChannel,
        });
      } catch {
        // ignore network errors here
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.phone]);

  function applyLastAddress() {
    if (match?.lastAddress) onApplyAddress(match.lastAddress);
  }

  return (
    <div className="mb-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("customer_label")}</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          inputMode="tel"
          autoComplete="off"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder={t("customer_phone_placeholder")}
          className="p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
        />
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={t("customer_name_placeholder")}
          className="p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
        />
      </div>
      <input
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder={t("customer_email_placeholder")}
        className="mt-2 w-full p-3.5 rounded-xl bg-bone border border-mute-200 text-ink outline-none focus:border-ink focus:bg-white"
      />
      <ChannelPicker
        value={value.messagingChannel}
        onChange={(v: MessagingChannel) => onChange({ ...value, messagingChannel: v })}
        emailAvailable={value.email.trim().length > 0}
      />
      {match && (
        <div className="mt-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-rouge/[0.06] border-l-2 border-rouge text-[12.5px] text-mute-700">
          <span>
            <strong className="text-rouge font-medium">{t("customer_recurring_star")}</strong>
            {" · "}
            {t(match.orderCount === 1 ? "customer_orders_one" : "customer_orders_other", { count: match.orderCount })}
            {match.lastCity ? ` · ${t("customer_last_city", { city: match.lastCity })}` : ""}
          </span>
          {match.lastAddress && (
            <button type="button" onClick={applyLastAddress} className="underline text-rouge">
              {t("customer_use_last_address")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
