"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Address } from "@/types/address";
import type { MessagingChannel } from "@/types/order";
import type { KnownRecipient, RecipientProfile } from "@/lib/recipient-history";
import ChannelPicker from "./ChannelPicker";
import AddressAutocomplete from "./AddressAutocomplete";

export type CustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
  messagingChannel: MessagingChannel;
  buyerAddress?: Address;
};

type Props = {
  value: CustomerSnapshot;
  onChange: (v: CustomerSnapshot) => void;
  onApplyAddress: (address: Address) => void;
  /** Staff tapped one of this sender's past recipients. */
  onPickRecipient: (recipient: KnownRecipient) => void;
};

// How many past recipients show before "show more".
const RECIPIENTS_SHOWN = 4;

export default function CustomerBlock({ value, onChange, onApplyAddress, onPickRecipient }: Props) {
  const t = useTranslations("admin_intake");
  const [match, setMatch] = useState<{ orderCount: number; lastCity?: string; lastAddress?: Address; messagingChannel?: MessagingChannel } | null>(null);
  const [recipients, setRecipients] = useState<KnownRecipient[]>([]);
  const [asRecipient, setAsRecipient] = useState<RecipientProfile | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const digits = value.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setMatch(null);
      setRecipients([]);
      setAsRecipient(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(digits)}`);
        if (!res.ok) return;
        const data = await res.json();
        setRecipients(data.recipients ?? []);
        setAsRecipient(data.asRecipient ?? null);
        setShowAll(false);
        if (!data.found) {
          setMatch(null);
          // Someone who only ever received flowers: they are the same person, so reuse the name.
          if (!value.name && data.asRecipient?.name) onChange({ ...value, name: data.asRecipient.name });
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
          buyerAddress: value.buyerAddress ?? c.buyerAddress,
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
      <div className="mt-3">
        <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("buyer_address_label")}</label>
        <AddressAutocomplete
          value={value.buyerAddress?.street1 ?? ""}
          onChange={(v) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { city: "", state: "NY", zip: "", country: "US" }), street1: v } as Address })}
          onSelect={(addr) => onChange({ ...value, buyerAddress: addr })}
          placeholder={t("buyer_address_placeholder")}
          className="w-full p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
        />
        <div className="mt-2 grid grid-cols-[1.4fr_0.6fr_0.7fr] gap-2 [&>input]:min-w-0">
          <input value={value.buyerAddress?.city ?? ""} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", state: "NY", zip: "", country: "US" }), city: e.target.value } as Address })} placeholder={t("fulfillment_city_placeholder")} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white" />
          <input value={value.buyerAddress?.state ?? "NY"} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", city: "", zip: "", country: "US" }), state: e.target.value.toUpperCase().slice(0, 2) } as Address })} maxLength={2} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white uppercase tracking-wider text-center" />
          <input value={value.buyerAddress?.zip ?? ""} onChange={(e) => onChange({ ...value, buyerAddress: { ...(value.buyerAddress ?? { street1: "", city: "", state: "NY", country: "US" }), zip: e.target.value.replace(/\D/g, "").slice(0, 5) } as Address })} inputMode="numeric" placeholder={t("fulfillment_zip_placeholder")} className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white tabular-nums text-center" />
        </div>
        {value.buyerAddress?.street1 && (
          <button type="button" onClick={() => value.buyerAddress && onApplyAddress(value.buyerAddress)} className="mt-2 text-rouge underline text-[12.5px]">
            {t("buyer_use_as_delivery")}
          </button>
        )}
      </div>
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
      {asRecipient && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-mute-100 text-[12.5px] text-mute-700">
          {t(asRecipient.orderCount === 1 ? "caller_received_one" : "caller_received_other", {
            count: asRecipient.orderCount,
            sender: asRecipient.senders[0]?.name || "—",
          })}
        </div>
      )}
      {recipients.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-widest text-mute-400 mb-1.5">{t("known_recipients_label")}</div>
          <div className="flex flex-wrap gap-1.5">
            {(showAll ? recipients : recipients.slice(0, RECIPIENTS_SHOWN)).map((r) => (
              <button
                key={r.phone || `name:${r.name}`}
                type="button"
                onClick={() => onPickRecipient(r)}
                aria-label={t("known_recipient_pick", { name: r.name })}
                className="text-left px-3 py-1.5 rounded-xl border border-mute-200 bg-bone hover:border-ink/40 transition"
              >
                <span className="block text-sm text-ink">{r.name || "—"}</span>
                <span className="block text-[11px] text-mute-500">
                  {[r.lastAddress?.city, r.orderCount > 1 ? `×${r.orderCount}` : null].filter(Boolean).join(" · ") || r.phone}
                </span>
              </button>
            ))}
            {!showAll && recipients.length > RECIPIENTS_SHOWN && (
              <button type="button" onClick={() => setShowAll(true)} className="px-3 py-1.5 text-sm text-rouge underline">
                {t("known_recipients_more", { count: recipients.length - RECIPIENTS_SHOWN })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
