"use client";
import { useState } from "react";
import type { Product } from "@/types/product";
import type { CartLine, OrderTotals } from "@/types/order";
import CustomerBlock, { type CustomerSnapshot } from "./CustomerBlock";
import FulfillmentBlock, { type FulfillmentState } from "./FulfillmentBlock";
import ProductPicker from "./ProductPicker";
import CartSummary from "./CartSummary";
import PaymentBlock, { type PaymentState } from "./PaymentBlock";
import { toOrderFulfillment } from "./FulfillmentBlock";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentState>({ status: "pending" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        source: channel,
        customer: {
          phone: customer.phone,
          name: customer.name,
          email: customer.email || undefined,
        },
        fulfillment: toOrderFulfillment(fulfillment),
        lines,
        totalsOverride: override,
        payment,
      };
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(JSON.stringify(data.errors ?? data.error ?? "unknown"));
        return;
      }
      const { orderId } = await res.json();
      router.replace(`/en/admin/intake?ok=${encodeURIComponent(orderId)}`);
      setCustomer({ name: "", phone: "", email: "" });
      setLines([]);
      setOverride({});
      setPayment({ status: "pending" });
    } finally {
      setSubmitting(false);
    }
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
            <PaymentBlock value={payment} onChange={setPayment} />
          </section>
        </div>

        <div className="px-7 py-4 border-t border-mute-100 bg-white">
          <div className="flex items-center justify-between">
            <button type="button" className="px-5 py-3 rounded-full border border-mute-200 text-mute-600">Descartar</button>
            <button
              type="button"
              disabled={submitting || lines.length === 0 || customer.name.length === 0 || customer.phone.replace(/\D/g, "").length < 10}
              onClick={onSubmit}
              className="px-7 py-3.5 rounded-full bg-ink text-bone font-display disabled:opacity-40"
            >
              {submitting ? "Guardando…" : "Guardar e imprimir ticket"}
            </button>
          </div>
          {error && <p className="text-error text-sm mt-2 break-all">{error}</p>}
        </div>
      </div>
    </main>
  );
}
