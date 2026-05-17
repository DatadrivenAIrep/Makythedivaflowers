"use client";
import type { Address } from "@/types/address";
import type { DeliverySlot, OrderFulfillment } from "@/types/order";

type Method = "in-store" | "delivery" | "pickup";

export type FulfillmentState = {
  method: Method;
  recipient: { name: string; phone: string };
  address: Address;
  window: { date: string; slot: DeliverySlot };
  cardMessage: string;
};

type Props = {
  value: FulfillmentState;
  onChange: (v: FulfillmentState) => void;
};

const SEGS: { id: Method; label: string }[] = [
  { id: "in-store", label: "Se lo lleva" },
  { id: "delivery", label: "Delivery" },
  { id: "pickup", label: "Pickup" },
];

export default function FulfillmentBlock({ value, onChange }: Props) {
  return (
    <div className="mb-5">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">Entrega</label>
      <div className="inline-flex p-1 bg-mute-100 rounded-full gap-0.5 mb-3">
        {SEGS.map((s) => (
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
            placeholder="Destinatario"
            className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
          <input
            inputMode="tel"
            value={value.recipient.phone}
            onChange={(e) => onChange({ ...value, recipient: { ...value.recipient, phone: e.target.value } })}
            placeholder="Tel destinatario"
            className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
          {value.method === "delivery" && (
            <>
              <input
                value={value.address.street1}
                onChange={(e) => onChange({ ...value, address: { ...value.address, street1: e.target.value } })}
                placeholder="Calle y número"
                autoComplete="address-line1"
                className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
              />
              <input
                value={value.address.street2 ?? ""}
                onChange={(e) => onChange({ ...value, address: { ...value.address, street2: e.target.value } })}
                placeholder="Apto, suite, piso (opcional)"
                autoComplete="address-line2"
                className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
              />
              <div className="grid grid-cols-[1.4fr_0.6fr_0.7fr] gap-2">
                <input
                  value={value.address.city}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, city: e.target.value } })}
                  placeholder="Ciudad"
                  autoComplete="address-level2"
                  className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
                />
                <input
                  value={value.address.state}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, state: e.target.value.toUpperCase().slice(0, 2) } })}
                  placeholder="Estado"
                  autoComplete="address-level1"
                  maxLength={2}
                  className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white uppercase tracking-wider text-center"
                />
                <input
                  value={value.address.zip}
                  onChange={(e) => onChange({ ...value, address: { ...value.address, zip: e.target.value.replace(/\D/g, "").slice(0, 5) } })}
                  placeholder="ZIP"
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
            <select
              value={value.window.slot}
              onChange={(e) => onChange({ ...value, window: { ...value.window, slot: e.target.value as DeliverySlot } })}
              className="p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white appearance-none"
            >
              <option value="morning">Mañana (9 – 12)</option>
              <option value="midday">Mediodía (12 – 2)</option>
              <option value="afternoon">Tarde (12 – 4)</option>
              <option value="evening">Noche (4 – 7)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
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
