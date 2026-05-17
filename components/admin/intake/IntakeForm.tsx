"use client";
import { useState } from "react";
import type { Product } from "@/types/product";
import type { CartLine, OrderTotals } from "@/types/order";
import CustomerBlock, { type CustomerSnapshot } from "./CustomerBlock";
import FulfillmentBlock, { type FulfillmentState } from "./FulfillmentBlock";
import ProductPicker from "./ProductPicker";
import CartSummary from "./CartSummary";

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
  const [fulfillment, setFulfillment] = useState<FulfillmentState>({
    method: "delivery",
    recipient: { name: "", phone: "" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: new Date().toISOString().slice(0, 10), slot: "midday" },
    cardMessage: "",
  });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [override, setOverride] = useState<Partial<OrderTotals>>({});

  function addLine(line: CartLine) {
    setLines((prev) => {
      if (line.kind === "catalog") {
        const idx = prev.findIndex(
          (l) => l.kind === "catalog" && l.productId === line.productId && l.variantId === line.variantId,
        );
        if (idx >= 0) {
          const next = [...prev];
          const cur = next[idx];
          next[idx] = { ...cur, qty: cur.qty + 1 } as CartLine;
          return next;
        }
      }
      return [...prev, line];
    });
  }

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
            <CustomerBlock
              value={customer}
              onChange={setCustomer}
              onApplyAddress={(addr) => setFulfillment((f) => ({ ...f, address: addr, method: "delivery" }))}
            />
            <FulfillmentBlock value={fulfillment} onChange={setFulfillment} />
            <div className="mb-5">
              <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">Mensaje en tarjeta</label>
              <textarea
                value={fulfillment.cardMessage}
                onChange={(e) => setFulfillment({ ...fulfillment, cardMessage: e.target.value })}
                placeholder="Para mi mamá, con todo mi cariño..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white resize-none"
              />
            </div>
          </section>
          <section className="p-7 bg-bone">
            <ProductPicker products={products} onAdd={addLine} />
            <CartSummary
              lines={lines}
              onChangeLines={setLines}
              fulfillmentMethod={fulfillment.method}
              deliveryZip={fulfillment.address.zip}
              override={override}
              onOverride={setOverride}
            />
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
