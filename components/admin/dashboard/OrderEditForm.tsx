"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Order, CartLine, OrderTotals } from "@/types/order";
import FulfillmentBlock, { type FulfillmentState, toOrderFulfillment } from "@/components/admin/intake/FulfillmentBlock";
import ProductPicker from "@/components/admin/intake/ProductPicker";
import CartLines from "@/components/admin/intake/CartLines";
import CartTotals from "@/components/admin/intake/CartTotals";
import { PRODUCTS } from "@/data/products";
import type { OrderEditPatch } from "@/lib/order-edit";

function orderToFulfillmentState(o: Order): FulfillmentState {
  const f = o.fulfillment;
  return {
    method: f.method,
    recipient: { ...f.recipient },
    address: f.method === "delivery" ? { ...f.address }
      : { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: f.method !== "in-store" ? { ...f.window }
      : { date: new Date().toISOString().slice(0, 10), slot: "midday" },
    cardMessage: f.cardMessage ?? "",
  };
}

export default function OrderEditForm({
  order, busy, onCancel, onSave,
}: {
  order: Order;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: OrderEditPatch) => void;
}) {
  const t = useTranslations("admin_orders");
  const [contact, setContact] = useState({
    name: order.contact.name ?? "", email: order.contact.email ?? "", phone: order.contact.phone,
  });
  const [fulfillment, setFulfillment] = useState<FulfillmentState>(orderToFulfillmentState(order));
  const [lines, setLines] = useState<CartLine[]>(order.lines);
  const [override, setOverride] = useState<Partial<OrderTotals>>({});

  function addLine(line: CartLine) {
    setLines((prev) => {
      if (line.kind === "catalog") {
        const idx = prev.findIndex((l) => l.kind === "catalog" && l.productId === line.productId && l.variantId === line.variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: (next[idx] as CartLine).qty + 1 } as CartLine;
          return next;
        }
      }
      return [...prev, line];
    });
  }

  function submit() {
    const f = toOrderFulfillment(fulfillment);
    const patch: OrderEditPatch = {
      contact: { name: contact.name || undefined, email: contact.email || undefined, phone: contact.phone },
      fulfillmentMethod: f.method,
      recipient: f.recipient,
      cardMessage: f.cardMessage ?? "",
      lines,
      ...(f.method === "delivery" ? { address: f.address } : {}),
      ...(f.method !== "in-store" ? { window: f.window } : {}),
      ...(Object.keys(override).length ? { totalsOverride: override } : {}),
    };
    onSave(patch);
  }

  return (
    <div className="space-y-4">
      <section className="rounded border border-ink/10 p-3 text-sm">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("contact")}</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder={t("phone")} className="rounded border border-ink/15 px-2 py-1" />
          <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder={t("name")} className="rounded border border-ink/15 px-2 py-1" />
        </div>
        <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder={t("email")} className="mt-2 w-full rounded border border-ink/15 px-2 py-1" />
      </section>

      <FulfillmentBlock value={fulfillment} onChange={setFulfillment} />

      <ProductPicker products={PRODUCTS} onAdd={addLine} />
      <CartLines lines={lines} onChangeLines={setLines} />
      <CartTotals
        lines={lines}
        fulfillmentMethod={fulfillment.method}
        deliveryZip={fulfillment.address.zip}
        deliveryCity={fulfillment.address.city}
        override={override}
        onOverride={setOverride}
      />

      <div className="flex gap-2">
        <button type="button" disabled={busy || lines.length === 0} onClick={submit}
          className="rounded-full bg-ink px-5 py-2 text-bone disabled:opacity-40">
          {busy ? t("saving") : t("save_changes")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}
          className="rounded-full border border-ink/20 px-4 py-2">{t("cancel")}</button>
      </div>
    </div>
  );
}
