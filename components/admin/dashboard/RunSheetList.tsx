"use client";
import { Truck, CheckCircle, Phone, NoteBlank, NavigationArrow } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import AdminButton from "./AdminButton";
import { resolveLine } from "./product-lookup";
import { deliveryZoneRank, findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { mapsDirectionsUrl } from "@/lib/maps-url";
import { groupRunSheetByZone } from "@/lib/run-sheet-zones";
import { formatClock } from "@/lib/format";
import type { Order } from "@/types/order";

const SLOT_ORDER = ["morning", "midday", "afternoon", "evening"] as const;

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

function itemsLine(o: Order): string {
  if (o.lines.length === 0) return "—";
  return o.lines.map((l) => {
    const r = resolveLine(l);
    const v = r.variantLabel ? ` (${r.variantLabel})` : "";
    return `${r.name}${v} ×${r.qty}`;
  }).join(", ");
}

function addonsLine(o: Order): string[] {
  return o.lines.flatMap((l) => resolveLine(l).addOnLabels);
}

// Zip of a delivery order, or "" for non-delivery (which never reaches here).
function deliveryZip(o: Order): string {
  return o.fulfillment.method === "delivery" ? o.fulfillment.address.zip : "";
}

type Advance = (orderId: string, status: "out-for-delivery" | "delivered") => void;

type RowProps = {
  o: Order;
  lang: "en" | "es";
  onOpen: (orderId: string) => void;
  onAdvance: Advance;
};

// One delivery card with its actions. Shared by both views (by time / by zone)
// so per-order rendering never drifts between them.
function RunSheetRow({ o, lang, onOpen, onAdvance }: RowProps) {
  const t = useTranslations("admin_dashboard");
  const to = useTranslations("admin_orders");
  if (o.fulfillment.method !== "delivery") return null;
  const f = o.fulfillment;
  const zone = findDeliveryZoneByZip(f.address.zip);
  const addons = addonsLine(o);
  const done = o.status === "delivered";
  return (
    <li className={`rounded-lg border border-ink/10 bg-bone p-3 text-sm shadow-sm ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 cursor-pointer" onClick={() => onOpen(o.id)}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{f.recipient.name}</span>
            <span className="text-xs text-ink/40">#{o.id.slice(-6)}</span>
            {f.window.time && (
              <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink/80 tabular-nums">
                🕐 {formatClock(f.window.time, lang)}
              </span>
            )}
            {zone && (
              <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] text-ink/70">{zone.label[lang]}</span>
            )}
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${o.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {o.paymentStatus === "paid" ? to("payment_status.paid")
                : (o.amountPaidCents ?? 0) > 0 ? t("collect_amount", { amount: money(o.totals.totalCents - (o.amountPaidCents ?? 0)) })
                : t("collect")}
            </span>
            <span className="ml-auto text-xs text-ink/60">{to("fulfillment_status." + o.status)} · {money(o.totals.totalCents)}</span>
          </div>
          <div className="mt-1 text-ink/80">
            {f.address.street1}, {f.address.city} {f.address.zip}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">{itemsLine(o)}</div>
          {addons.length > 0 && <div className="text-xs text-emerald-700">+ {addons.join(", ")}</div>}
          {f.cardMessage && (
            <div className="mt-1 flex items-start gap-1.5 rounded bg-ink/5 p-1.5 text-xs italic">
              <NoteBlank size={14} weight="bold" className="mt-0.5 flex-shrink-0" />
              <span>&quot;{f.cardMessage}&quot;</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-ink/5 pt-2">
        <AdminButton variant="secondary" icon={NavigationArrow} href={mapsDirectionsUrl(f.address)} target="_blank" rel="noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()}>{t("action_directions")}</AdminButton>
        <AdminButton variant="secondary" icon={Phone} href={`tel:${f.recipient.phone}`} onClick={(e) => e.stopPropagation()}>{f.recipient.phone}</AdminButton>
        {o.status !== "delivered" && o.status !== "out-for-delivery" && (
          <AdminButton variant="secondary" icon={Truck} onClick={() => onAdvance(o.id, "out-for-delivery")}>{t("action_en_route")}</AdminButton>
        )}
        {o.status !== "delivered" && (
          <AdminButton variant="primary" icon={CheckCircle} onClick={() => onAdvance(o.id, "delivered")}>{t("action_delivered")}</AdminButton>
        )}
      </div>
    </li>
  );
}

export type RunSheetViewMode = "time" | "zone";

type Props = {
  orders: Order[];
  locale: string;
  /** "time" (default) buckets by slot; "zone" buckets by delivery zone. */
  view?: RunSheetViewMode;
  onOpen: (orderId: string) => void;
  onAdvance: Advance;
};

type Group = { key: string; title: string; orders: Order[] };

export default function RunSheetList({ orders, locale, view = "time", onOpen, onAdvance }: Props) {
  const t = useTranslations("admin_dashboard");
  const to = useTranslations("admin_orders");
  const lang = locale === "en" ? "en" : "es";

  // Only deliveries are listed (the run-sheet API returns nothing else); the
  // zone grouping's pickups bucket is therefore ignored, like the time view.
  const groups: Group[] = view === "zone"
    ? groupRunSheetByZone(orders).groups.map((g) => ({
        key: g.key,
        title: g.zone ? g.zone.label[lang] : t("zone_none"),
        orders: g.orders,
      }))
    : SLOT_ORDER.map((slot) => ({
        key: slot,
        title: to("slot." + slot),
        orders: orders
          .filter((o) => o.fulfillment.method === "delivery" && o.fulfillment.window.slot === slot)
          // Relies on Array.prototype.sort being stable (ES2019+) so same-zone
          // orders keep the API's original ordering.
          .sort((a, b) => deliveryZoneRank(deliveryZip(a)) - deliveryZoneRank(deliveryZip(b))),
      })).filter((g) => g.orders.length > 0);

  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/60">
            {group.title} · {group.orders.length}
          </h2>
          <ul className="space-y-2">
            {group.orders.map((o) => (
              <RunSheetRow key={o.id} o={o} lang={lang} onOpen={onOpen} onAdvance={onAdvance} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
