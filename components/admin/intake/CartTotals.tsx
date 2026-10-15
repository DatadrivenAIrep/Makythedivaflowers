"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePricedProducts } from "@/components/catalog/PricedCatalog";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForAddress } from "@/lib/totals";
import type { CartLine, OrderTotals } from "@/types/order";

type Props = {
  lines: CartLine[];
  fulfillmentMethod: "in-store" | "delivery" | "pickup";
  deliveryZip: string;
  deliveryCity: string;
  override: Partial<OrderTotals>;
  onOverride: (next: Partial<OrderTotals>) => void;
  /** Tax-exempt order: tax is $0 and can't be overridden (mirrors resolveOrderTotals). */
  taxExempt?: boolean;
  /** Discount/tip already on the order (edit form); an override on either still wins. */
  baseDiscountCents?: number;
  baseTipCents?: number;
};

function EditableAmount({ cents, computed, onSet, onClear }: { cents: number; computed: number; onSet: (v: number) => void; onClear: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const overridden = cents !== computed;
  function commit() {
    const v = Math.round(parseFloat(draft) * 100);
    if (!Number.isNaN(v) && v >= 0) onSet(v);
    setEditing(false);
  }
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border border-ink/30 px-2 py-0.5 text-right tabular-nums text-sm"
      />
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={() => { setDraft((cents / 100).toFixed(2)); setEditing(true); }} className={`tabular-nums ${overridden ? "text-rouge font-medium" : ""}`}>
        ${(cents / 100).toFixed(2)} <span className="text-mute-400">✎</span>
      </button>
      {overridden && <button type="button" onClick={onClear} className="text-[11px] text-mute-400 hover:text-rouge">↺</button>}
    </span>
  );
}

export default function CartTotals({
  lines, fulfillmentMethod, deliveryZip, deliveryCity, override, onOverride,
  taxExempt = false, baseDiscountCents = 0, baseTipCents = 0,
}: Props) {
  const products = usePricedProducts();
  const t = useTranslations("admin_intake");
  const tx = useTranslations("admin_tax_exempt");
  const resolvedDelivery = useMemo(
    () => (fulfillmentMethod === "delivery" ? computeDeliveryCentsForAddress({ zip: deliveryZip, city: deliveryCity }) : 0),
    [fulfillmentMethod, deliveryZip, deliveryCity],
  );
  const computed = useMemo(
    () => computeOrderTotals(cartSubtotalCents(lines, products), resolvedDelivery ?? 0, 0, 0, { taxExempt }),
    [lines, products, resolvedDelivery, taxExempt],
  );
  // Cascade: overriding subtotal/delivery flows into tax + total (matches the
  // server's resolveOrderTotals). Only an explicit override on a field pins it.
  const subtotalCents = override.subtotalCents ?? computed.subtotalCents;
  const deliveryCents = override.deliveryCents ?? computed.deliveryCents;
  // Discount/tip: the override wins, else the order's own (edit form; 0 on
  // intake). Kept in the cascade so this mirrors the server's
  // resolveOrderTotals rather than drifting from it.
  const recomputed = computeOrderTotals(
    subtotalCents,
    deliveryCents,
    override.discountCents ?? baseDiscountCents,
    override.tipCents ?? baseTipCents,
    { taxExempt },
  );
  const discountCents = recomputed.discountCents;
  const tipCents = recomputed.tipCents;
  const taxCents = taxExempt ? 0 : (override.taxCents ?? recomputed.taxCents);
  const totalCents =
    override.totalCents ?? subtotalCents + deliveryCents - discountCents + taxCents + tipCents;
  const totals: OrderTotals = {
    subtotalCents,
    deliveryCents,
    discountCents,
    tipCents,
    taxCents,
    totalCents,
  };
  // "natural[k]" = value each field would show without an override ON ITSELF, so
  // the rouge/reset indicator only marks explicitly-overridden fields.
  const natural: OrderTotals = {
    subtotalCents: computed.subtotalCents,
    deliveryCents: computed.deliveryCents,
    discountCents,
    tipCents,
    taxCents: recomputed.taxCents,
    totalCents: subtotalCents + deliveryCents - discountCents + taxCents + tipCents,
  };
  const set = (k: keyof OrderTotals) => (v: number) => onOverride({ ...override, [k]: v });
  const clear = (k: keyof OrderTotals) => () => { const n = { ...override }; delete n[k]; onOverride(n); };

  const row = (label: string, k: keyof OrderTotals) => (
    <div className="flex justify-between items-center text-mute-600 py-1">
      <span>{label}</span>
      <EditableAmount cents={totals[k]} computed={natural[k]} onSet={set(k)} onClear={clear(k)} />
    </div>
  );

  const deliveryUnresolved =
    fulfillmentMethod === "delivery" && resolvedDelivery === null && override.deliveryCents === undefined;

  return (
    <div className="border-t border-mute-100 pt-3.5 text-sm">
      {row(t("totals_subtotal"), "subtotalCents")}
      {deliveryUnresolved ? (
        <div className="py-1">
          <div className="flex justify-between items-center text-rouge">
            <span>{t("totals_delivery")}</span>
            <EditableAmount cents={0} computed={-1} onSet={set("deliveryCents")} onClear={clear("deliveryCents")} />
          </div>
          <p className="text-[11.5px] text-rouge/80 mt-0.5">{t("totals_delivery_unresolved_hint")}</p>
        </div>
      ) : row(t("totals_delivery"), "deliveryCents")}
      {discountCents > 0 && (
        <div className="flex justify-between items-center text-rouge py-1">
          <span>{t("totals_discount")}</span>
          <span className="tabular-nums">−${(discountCents / 100).toFixed(2)}</span>
        </div>
      )}
      {tipCents > 0 && (
        <div className="flex justify-between items-center text-mute-600 py-1">
          <span>{t("totals_tip")}</span>
          <span className="tabular-nums">${(tipCents / 100).toFixed(2)}</span>
        </div>
      )}
      {taxExempt ? (
        <div className="flex justify-between items-center text-mute-600 py-1">
          <span>{t("totals_tax")}</span>
          <span className="tabular-nums">{`$0.00 · ${tx("exempt_row")}`}</span>
        </div>
      ) : row(t("totals_tax"), "taxCents")}
      <div className="flex justify-between items-center border-t border-mute-100 mt-2 pt-2.5 font-display text-base">
        <span>{t("totals_total")}</span>
        <EditableAmount cents={totals.totalCents} computed={natural.totalCents} onSet={set("totalCents")} onClear={clear("totalCents")} />
      </div>
    </div>
  );
}
