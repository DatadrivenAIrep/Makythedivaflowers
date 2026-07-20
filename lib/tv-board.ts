import "server-only";
import type { DeliverySlot, Order, OrderSource } from "@/types/order";
import {
  SHOP_TZ, SLOT_ORDER, addDaysStr, minutesUntilSlotStart, shopDateStr, urgencyLevel, type Urgency,
} from "@/lib/tv-slots";
import { firstThumb, lineSummaryName } from "@/components/admin/dashboard/product-lookup";
import { deliveryZoneRank, findDeliveryZoneByZip } from "@/lib/delivery-zones";

export type TvCard = {
  orderId: string;
  orderNumber: number | null;
  recipientName: string;
  productLabel: string;
  thumb: string | null;
  source: OrderSource;
  fulfillmentStatus: "pending" | "preparing";
  method: "delivery" | "pickup";
  zoneLabel: string | null;
  slot: DeliverySlot;
  windowDate: string;
  hasCardMessage: boolean;
  hasDesignerNotes: boolean;
  minutesUntil: number;
  urgency: Urgency;
};

export type TvEnRuta = {
  orderId: string; orderNumber: number | null; zoneLabel: string | null; since: string;
};

export type TvBoardData = {
  todo: TvCard[];
  enRuta: TvEnRuta[];
  deliveredToday: number;
  tomorrow: { bySlot: Record<DeliverySlot, number>; total: number };
};

export type ComputeDeps = {
  now: Date;
  tz?: string;
  resolveThumb?: (o: Order) => string | null;
  resolveLabel?: (o: Order) => string;
};

type WindowOrder = Order & {
  fulfillment: { method: "delivery" | "pickup"; window: { date: string; slot: DeliverySlot } };
};

function isWindowOrder(o: Order): o is WindowOrder {
  return o.fulfillment.method === "delivery" || o.fulfillment.method === "pickup";
}
function zipOf(o: Order): string | null {
  return o.fulfillment.method === "delivery" ? o.fulfillment.address.zip : null;
}
function rankOf(o: Order): number {
  const zip = zipOf(o);
  return zip == null ? Number.MAX_SAFE_INTEGER : deliveryZoneRank(zip);
}
function zoneLabelOf(o: Order): string | null {
  const zip = zipOf(o);
  return zip ? (findDeliveryZoneByZip(zip)?.label.es ?? null) : null;
}
function hasDesignerNotes(o: Order): boolean {
  return o.lines.some((l) => l.kind === "custom" && !!l.designerNotes);
}

export function computeBoard(orders: Order[], deps: ComputeDeps): TvBoardData {
  const tz = deps.tz ?? SHOP_TZ;
  const now = deps.now;
  const today = shopDateStr(now, tz);
  const tomorrow = addDaysStr(today, 1);
  const resolveThumb = deps.resolveThumb ?? firstThumb;
  const resolveLabel = deps.resolveLabel ?? lineSummaryName;

  const windowOrders = orders.filter(isWindowOrder);
  const todayOrders = windowOrders.filter((o) => o.fulfillment.window.date === today);

  const todoOrders = todayOrders
    .filter((o) => o.paymentStatus === "paid" && (o.status === "pending" || o.status === "preparing"))
    .sort((a, b) => {
      const sa = SLOT_ORDER.indexOf(a.fulfillment.window.slot);
      const sb = SLOT_ORDER.indexOf(b.fulfillment.window.slot);
      if (sa !== sb) return sa - sb;
      const ra = rankOf(a), rb = rankOf(b);
      if (ra !== rb) return ra - rb;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const todo: TvCard[] = todoOrders.map((o) => {
    const slot = o.fulfillment.window.slot;
    const minutesUntil = minutesUntilSlotStart(now, o.fulfillment.window.date, slot, tz);
    return {
      orderId: o.id,
      orderNumber: o.orderNumber ?? null,
      recipientName: o.fulfillment.recipient.name,
      productLabel: resolveLabel(o),
      thumb: resolveThumb(o),
      source: o.source,
      fulfillmentStatus: o.status as "pending" | "preparing",
      method: o.fulfillment.method,
      zoneLabel: zoneLabelOf(o),
      slot,
      windowDate: o.fulfillment.window.date,
      hasCardMessage: !!o.fulfillment.cardMessage,
      hasDesignerNotes: hasDesignerNotes(o),
      minutesUntil,
      urgency: urgencyLevel(minutesUntil),
    };
  });

  const enRuta: TvEnRuta[] = todayOrders
    .filter((o) => o.status === "out-for-delivery")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((o) => ({
      orderId: o.id, orderNumber: o.orderNumber ?? null, zoneLabel: zoneLabelOf(o), since: o.updatedAt,
    }));

  const deliveredToday = todayOrders.filter((o) => o.status === "delivered").length;

  const bySlot: Record<DeliverySlot, number> = { morning: 0, midday: 0, afternoon: 0, evening: 0 };
  const tomorrowOrders = windowOrders.filter((o) => o.fulfillment.window.date === tomorrow);
  for (const o of tomorrowOrders) bySlot[o.fulfillment.window.slot] += 1;

  return { todo, enRuta, deliveredToday, tomorrow: { bySlot, total: tomorrowOrders.length } };
}
