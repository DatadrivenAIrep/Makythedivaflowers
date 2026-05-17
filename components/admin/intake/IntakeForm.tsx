"use client";
import { useState } from "react";
import type { Product } from "@/types/product";
import CustomerBlock, { type CustomerSnapshot } from "./CustomerBlock";

type Channel = "walk-in" | "phone" | "whatsapp" | "event";
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "walk-in", label: "Walk-in" },
  { id: "phone", label: "Teléfono" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "event", label: "Evento" },
];

export default function IntakeForm({ products }: { products: Product[] }) {
  const [channel, setChannel] = useState<Channel>("walk-in");
  const [customer, setCustomer] = useState<CustomerSnapshot>({ name: "", phone: "", email: "" });
  void products; // Used by later tasks (ProductPicker)

  return (
    <main className="max-w-[1180px] mx-auto p-6">
      <p className="text-mute-500 text-sm mb-2">Diva Flowers · iPad intake</p>
      <h1 className="font-display text-3xl text-ink mb-6">Nuevo pedido</h1>

      <div className="bg-white rounded-bento shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-mute-100">
          <div className="flex gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                  channel === c.id
                    ? "bg-ink text-bone"
                    : "bg-mute-100 text-mute-600 hover:bg-mute-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="text-mute-400 text-xs tabular-nums">{new Date().toLocaleString("es-MX")}</div>
        </div>

        <div className="grid grid-cols-[1.05fr_0.95fr]">
          <section className="p-7 border-r border-mute-100">
            <CustomerBlock value={customer} onChange={setCustomer} onApplyAddress={() => {}} />
          </section>
          <section className="p-7 bg-bone">
            {/* ProductPicker + Cart + Totals + PaymentBlock in next tasks */}
          </section>
        </div>

        <div className="flex items-center justify-between px-7 py-4 border-t border-mute-100 bg-white">
          <button type="button" className="px-5 py-3 rounded-full border border-mute-200 text-mute-600">Descartar</button>
          <button type="submit" className="px-7 py-3.5 rounded-full bg-ink text-bone font-display">Guardar e imprimir ticket</button>
        </div>
      </div>
    </main>
  );
}
