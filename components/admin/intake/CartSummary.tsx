"use client";
import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { PRODUCTS } from "@/data/products";
import { cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals, computeDeliveryCentsForAddress } from "@/lib/totals";
import type { CartLine, OrderTotals } from "@/types/order";

type Props = {
  lines: CartLine[];
  onChangeLines: (lines: CartLine[]) => void;
  fulfillmentMethod: "in-store" | "delivery" | "pickup";
  deliveryZip: string;
  deliveryCity: string;
  override: Partial<OrderTotals>;
  onOverride: (next: Partial<OrderTotals>) => void;
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CartSummary({ lines, onChangeLines, fulfillmentMethod, deliveryZip, deliveryCity, override, onOverride }: Props) {
  const t = useTranslations("admin_intake");
  const locale = useLocale() as "en" | "es";

  // Resolve the delivery fee from the ZIP first, then the city. Null means we
  // couldn't price it from the address — surface that instead of charging $0.
  const resolvedDeliveryCents = useMemo(
    () =>
      fulfillmentMethod === "delivery"
        ? computeDeliveryCentsForAddress({ zip: deliveryZip, city: deliveryCity })
        : 0,
    [fulfillmentMethod, deliveryZip, deliveryCity],
  );

  const computed = useMemo(() => {
    const subtotal = cartSubtotalCents(lines, PRODUCTS);
    return computeOrderTotals(subtotal, resolvedDeliveryCents ?? 0);
  }, [lines, resolvedDeliveryCents]);

  // Delivery is "unresolved" when the method is delivery, the address didn't
  // price it, and the owner hasn't typed a manual fee. We warn rather than
  // silently book $0 — far/custom deliveries still get charged.
  const deliveryUnresolved =
    fulfillmentMethod === "delivery" &&
    resolvedDeliveryCents === null &&
    override.deliveryCents === undefined;

  const totals: OrderTotals = {
    subtotalCents: override.subtotalCents ?? computed.subtotalCents,
    deliveryCents: override.deliveryCents ?? computed.deliveryCents,
    taxCents: override.taxCents ?? computed.taxCents,
    totalCents: override.totalCents ?? computed.totalCents,
  };

  function removeLine(i: number) {
    onChangeLines(lines.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="bg-white border border-mute-100 rounded-2xl px-3.5 mb-4">
        {lines.length === 0 && (
          <div className="py-4 text-mute-400 text-sm">{t("cart_empty")}</div>
        )}
        {lines.map((l, i) => {
          const label =
            l.kind === "catalog"
              ? PRODUCTS.find((p) => p.id === l.productId)?.title[locale] ?? l.productId
              : null;
          const unit =
            l.kind === "catalog"
              ? PRODUCTS.find((p) => p.id === l.productId)?.variants.find((v) => v.id === l.variantId)?.priceCents ?? 0
              : l.priceCents;
          return (
            <div key={i} className="flex justify-between items-center py-2.5 text-sm border-b border-dashed border-mute-100 last:border-0">
              <span>
                <span className="text-mute-400">{l.qty} ×</span>{" "}
                {l.kind === "catalog" ? label : (
                  <em className="not-italic font-display text-rouge italic">{l.title}</em>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{money(unit * l.qty)}</span>
                <button type="button" onClick={() => removeLine(i)} className="text-mute-400 hover:text-rouge">✕</button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-mute-100 pt-3.5 text-sm">
        <Row label={t("totals_subtotal")} cents={totals.subtotalCents} computedCents={computed.subtotalCents} onOverride={(v) => onOverride({ ...override, subtotalCents: v })} />
        {deliveryUnresolved ? (
          <div className="py-1">
            <div className="flex justify-between text-mute-600">
              <span>{t("totals_delivery")}</span>
              <button
                type="button"
                onClick={() => {
                  const raw = window.prompt(`${t("totals_delivery")} $`, "");
                  if (raw == null) return;
                  const v = Math.round(parseFloat(raw) * 100);
                  if (!Number.isNaN(v) && v >= 0) onOverride({ ...override, deliveryCents: v });
                }}
                className="tabular-nums text-rouge font-medium underline"
              >
                {t("totals_delivery_unresolved")}
              </button>
            </div>
            <p className="text-[11.5px] text-rouge/80 mt-0.5">{t("totals_delivery_unresolved_hint")}</p>
          </div>
        ) : (
          <Row label={t("totals_delivery")} cents={totals.deliveryCents} computedCents={computed.deliveryCents} onOverride={(v) => onOverride({ ...override, deliveryCents: v })} />
        )}
        <Row label={t("totals_tax")} cents={totals.taxCents} computedCents={computed.taxCents} onOverride={(v) => onOverride({ ...override, taxCents: v })} />
        <div className="flex justify-between border-t border-mute-100 mt-2 pt-2.5 font-display text-base">
          <span>{t("totals_total")}</span>
          <button
            type="button"
            onClick={() => {
              const raw = window.prompt(t("totals_prompt", { label: t("totals_total") }), (totals.totalCents / 100).toFixed(2));
              if (raw == null) return;
              const v = Math.round(parseFloat(raw) * 100);
              if (!Number.isNaN(v) && v >= 0) onOverride({ ...override, totalCents: v });
            }}
            className="tabular-nums"
          >
            {money(totals.totalCents)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, cents, computedCents, onOverride }: { label: string; cents: number; computedCents: number; onOverride: (v: number) => void }) {
  const overridden = cents !== computedCents;
  return (
    <div className="flex justify-between text-mute-600 py-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => {
          const raw = window.prompt(`${label} $`, (cents / 100).toFixed(2));
          if (raw == null) return;
          const v = Math.round(parseFloat(raw) * 100);
          if (!Number.isNaN(v) && v >= 0) onOverride(v);
        }}
        className={`tabular-nums ${overridden ? "text-rouge" : ""}`}
      >
        ${(cents / 100).toFixed(2)}
      </button>
    </div>
  );
}
