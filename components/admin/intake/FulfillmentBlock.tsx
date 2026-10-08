"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateOnly } from "@/lib/format-datetime";
import type { Address } from "@/types/address";
import type { DeliverySlot, OrderFulfillment } from "@/types/order";
import type { RecipientProfile } from "@/lib/recipient-history";
import { slotForTime } from "@/lib/tv-slots";
import { sameAddress } from "@/lib/address-key";
import { CARD_MESSAGE_LONG_HINT_AT, CARD_MESSAGE_MAX } from "@/lib/card-message-fit";
import AddressAutocomplete from "./AddressAutocomplete";
import FuneralHomePicker from "./FuneralHomePicker";

type Method = "in-store" | "delivery" | "pickup";

const SLOTS: DeliverySlot[] = ["morning", "midday", "afternoon", "evening"];

export type FulfillmentState = {
  method: Method;
  recipient: { name: string; phone: string };
  address: Address;
  window: { date: string; slot: DeliverySlot; time?: string };
  cardMessage: string;
  /** Optional so drafts saved before the funeral toggle still load. */
  funeral?: boolean;
  /** Save the delivery day as the recipient's yearly date on the buyer's profile. */
  rememberDate?: RememberKind | null;
};

type RememberKind = "birthday" | "anniversary";
const REMEMBER_KINDS: RememberKind[] = ["birthday", "anniversary"];

type Props = {
  value: FulfillmentState;
  onChange: (v: FulfillmentState) => void;
};

export default function FulfillmentBlock({ value, onChange }: Props) {
  const t = useTranslations("admin_intake");
  const to = useTranslations("admin_orders");
  const locale = useLocale();
  const known = useRecipientLookup(value, onChange);
  const segs: { id: Method; label: string }[] = [
    { id: "in-store", label: t("fulfillment_in_store") },
    { id: "delivery", label: t("fulfillment_delivery") },
    { id: "pickup", label: t("fulfillment_pickup") },
  ];

  return (
    <div className="mb-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("fulfillment_label")}</label>
      <div className="inline-flex p-1 bg-mute-100 rounded-full gap-0.5 mb-3">
        {segs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange({ ...value, method: s.id })}
            className={`px-4 py-2 rounded-full text-sm transition ${
              value.method === s.id ? "bg-white text-ink font-medium shadow-sm" : "text-mute-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {value.method !== "in-store" && (
        <div className="grid gap-2">
          <input
            value={value.recipient.name}
            onChange={(e) => onChange({ ...value, recipient: { ...value.recipient, name: e.target.value } })}
            placeholder={t("fulfillment_recipient_name_placeholder")}
            className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
          <input
            inputMode="tel"
            value={value.recipient.phone}
            onChange={(e) => onChange({ ...value, recipient: { ...value.recipient, phone: e.target.value } })}
            placeholder={t("fulfillment_recipient_phone_placeholder")}
            className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
          {known && (
            <div className="px-3 py-2 rounded-lg bg-rouge/[0.06] border-l-2 border-rouge text-[12.5px] text-mute-700">
              {t(known.orderCount === 1 ? "recipient_known_one" : "recipient_known_other", {
                count: known.orderCount,
                sender: known.senders[0]?.name || "—",
              })}
            </div>
          )}
          {known && known.addresses.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-mute-400 mb-1.5">{t("recipient_addresses_label")}</div>
              <div className="grid gap-1.5" role="radiogroup" aria-label={t("recipient_addresses_label")}>
                {known.addresses.map((a) => {
                  const selected = value.method === "delivery" && sameAddress(a.address, value.address);
                  return (
                    <button
                      key={`${a.address.street1}|${a.address.street2 ?? ""}|${a.address.zip}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange({ ...value, method: "delivery", address: { ...a.address } })}
                      className={`flex items-center justify-between gap-3 text-left px-3 py-2 rounded-xl border transition ${
                        selected ? "border-ink bg-white shadow-sm" : "border-mute-200 bg-bone hover:border-ink/40"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-ink truncate">
                          {a.address.street1}
                          {a.address.street2 ? `, ${a.address.street2}` : ""}
                        </span>
                        <span className="block text-[11px] text-mute-500">
                          {a.address.city}, {a.address.state} {a.address.zip}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-mute-500 tabular-nums">
                        {selected ? "✓ " : ""}
                        {t(a.orderCount === 1 ? "recipient_address_used_one" : "recipient_address_used_other", { count: a.orderCount })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {value.method === "delivery" && (
            <>
              <AddressAutocomplete
                value={value.address.street1}
                onChange={(v) => onChange({ ...value, address: { ...value.address, street1: v } })}
                onSelect={(addr) => onChange({ ...value, address: { ...value.address, ...addr } })}
                placeholder={t("fulfillment_street1_placeholder")}
                className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white w-full"
              />
              <input
                value={value.address.street2 ?? ""}
                onChange={(e) => onChange({ ...value, address: { ...value.address, street2: e.target.value } })}
                placeholder={t("fulfillment_street2_placeholder")}
                autoComplete="address-line2"
                className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
              />
              <div className="grid grid-cols-[1.4fr_0.6fr_0.7fr] gap-2 [&>input]:min-w-0">
                <input
                  value={value.address.city}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, city: e.target.value } })}
                  placeholder={t("fulfillment_city_placeholder")}
                  autoComplete="address-level2"
                  className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
                />
                <input
                  value={value.address.state}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, state: e.target.value.toUpperCase().slice(0, 2) } })}
                  placeholder={t("fulfillment_state_placeholder")}
                  autoComplete="address-level1"
                  maxLength={2}
                  className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white uppercase tracking-wider text-center"
                />
                <input
                  value={value.address.zip}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, zip: e.target.value.replace(/\D/g, "").slice(0, 5) } })}
                  placeholder={t("fulfillment_zip_placeholder")}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white tabular-nums text-center"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={value.window.date}
              onChange={(e) => onChange({ ...value, window: { ...value.window, date: e.target.value } })}
              className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
            />
            <input
              type="time"
              value={value.window.time ?? ""}
              onChange={(e) => {
                const time = e.target.value; // "" when cleared, else "HH:MM"
                onChange({
                  ...value,
                  window: {
                    ...value.window,
                    time: time || undefined,
                    // Keep the slot in sync so the run sheet / TV board still bucket.
                    slot: time ? slotForTime(time) : value.window.slot,
                  },
                });
              }}
              aria-label={t("delivery_time_label")}
              className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white tabular-nums"
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-mute-400 mb-1.5">
              {value.window.time ? t("slot_from_time_label") : t("slot_flexible_label")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SLOTS.map((s) => {
                const active = value.window.slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    // Picking a window explicitly clears any exact time (goes flexible).
                    onClick={() => onChange({ ...value, window: { ...value.window, slot: s, time: undefined } })}
                    className={`px-3 py-1.5 rounded-full text-sm transition border ${
                      active
                        ? "bg-ink text-bone border-ink"
                        : "bg-bone text-mute-600 border-mute-200 hover:border-ink/40"
                    }`}
                  >
                    {to("slot." + s)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("card_message_label")}</label>
        <textarea
          value={value.cardMessage}
          onChange={(e) => onChange({ ...value, cardMessage: e.target.value })}
          placeholder={t("card_message_placeholder")}
          rows={value.cardMessage.length > CARD_MESSAGE_LONG_HINT_AT ? 6 : 3}
          maxLength={CARD_MESSAGE_MAX}
          className="w-full p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white resize-y"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-mute-400">
          <span>{value.cardMessage.length > CARD_MESSAGE_LONG_HINT_AT ? t("card_message_long_hint") : ""}</span>
          <span className="tabular-nums shrink-0">
            {t("card_message_counter", { count: value.cardMessage.length, max: CARD_MESSAGE_MAX })}
          </span>
        </div>
        <label className="mt-2 flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.funeral ?? false}
            onChange={(e) => onChange({ ...value, funeral: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-ink"
          />
          <span className="text-sm">
            {t("funeral_label")}
            <span className="block text-xs text-mute-400">{t("funeral_hint")}</span>
          </span>
        </label>
        {value.funeral && value.method !== "in-store" && (
          <FuneralHomePicker
            address={value.address}
            onPick={(address) => onChange({ ...value, method: "delivery", address })}
          />
        )}
        {canRememberDate(value) && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-widest text-mute-400 mb-1.5">{t("remember_date_label")}</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("remember_date_label")}>
              {([null, ...REMEMBER_KINDS] as const).map((k) => {
                const active = (value.rememberDate ?? null) === k;
                return (
                  <button
                    key={k ?? "none"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...value, rememberDate: k })}
                    className={`px-3 py-1.5 rounded-full text-sm transition border ${
                      active ? "bg-ink text-bone border-ink" : "bg-bone text-mute-600 border-mute-200 hover:border-ink/40"
                    }`}
                  >
                    {t(k ? `remember_date_${k}` : "remember_date_none")}
                  </button>
                );
              })}
            </div>
            {value.rememberDate && (
              <p className="mt-1.5 text-xs text-mute-400">
                {t("remember_date_hint", { name: value.recipient.name.trim(), date: formatDateOnly(value.window.date, locale) })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



/**
 * Looks the recipient's phone up in past orders. A known recipient fills the
 * name and, for a delivery with no street yet, their last address — never
 * overwriting what staff already typed.
 */
function useRecipientLookup(value: FulfillmentState, onChange: (v: FulfillmentState) => void): RecipientProfile | null {
  const [known, setKnown] = useState<RecipientProfile | null>(null);
  // The lookup resolves after a debounce; read the freshest form state then.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const digits = value.recipient.phone.replace(/\D/g, "");
  const active = value.method !== "in-store" && digits.length >= 10;

  useEffect(() => {
    if (!active) {
      setKnown(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/recipients/lookup?phone=${encodeURIComponent(digits)}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { found: boolean; recipient?: RecipientProfile };
        if (cancelled) return;
        const r = data.found ? data.recipient ?? null : null;
        setKnown(r);
        if (!r) return;
        const { value: cur, onChange: emit } = latest.current;
        const fillName = !cur.recipient.name.trim() && r.name;
        const fillAddress = cur.method === "delivery" && !cur.address.street1.trim() && r.lastAddress;
        if (fillName || fillAddress) {
          emit({
            ...cur,
            recipient: fillName ? { ...cur.recipient, name: r.name } : cur.recipient,
            address: fillAddress ? { ...r.lastAddress! } : cur.address,
          });
        }
      } catch {
        // Lookup is a convenience; the form works without it.
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [active, digits]);

  return active ? known : null;
}

/** Only a dated order for someone other than "the shop's own counter sale" has a day worth remembering. */
export function canRememberDate(f: FulfillmentState): boolean {
  return f.method !== "in-store" && !f.funeral && f.recipient.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.window.date);
}

export function toOrderFulfillment(f: FulfillmentState): OrderFulfillment {
  if (f.method === "in-store") {
    return { method: "in-store", recipient: f.recipient, cardMessage: f.cardMessage || undefined };
  }
  if (f.method === "pickup") {
    return { method: "pickup", recipient: f.recipient, window: f.window, cardMessage: f.cardMessage || undefined };
  }
  return {
    method: "delivery",
    recipient: f.recipient,
    address: f.address,
    window: f.window,
    cardMessage: f.cardMessage || undefined,
  };
}
