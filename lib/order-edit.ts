import "server-only";
import { getOrder, updateOrder } from "@/lib/order-storage";
import { recordOrderChange } from "@/lib/order-history";
import { resolveOrderTotals } from "@/lib/totals";
import { PRODUCTS } from "@/data/products";
import type {
  Order, OrderFulfillment, CartLine, FieldDiff, OrderTotals,
  Recipient, DeliveryWindow, OrderChange,
} from "@/types/order";
import type { Address } from "@/types/address";

export type OrderEditPatch = {
  contact?: { name?: string; email?: string; phone?: string };
  recipient?: Partial<Recipient>;
  fulfillmentMethod?: "in-store" | "delivery" | "pickup";
  address?: Address;
  window?: DeliveryWindow;
  cardMessage?: string;
  lines?: CartLine[];
  totalsOverride?: Partial<OrderTotals>;
};

function money(c: number): string { return `$${(c / 100).toFixed(2)}`; }

function linesSummary(lines: CartLine[]): string {
  if (lines.length === 0) return "(vacío)";
  return lines.map((l) => {
    if (l.kind === "custom") return `${l.qty}× ${l.title}`;
    const p = PRODUCTS.find((x) => x.id === l.productId);
    return `${l.qty}× ${p ? p.title.es : l.productId}`;
  }).join(", ");
}

// Apply the patch onto a copy of the order, recomputing fulfillment + totals.
function applyPatch(cur: Order, patch: OrderEditPatch): Order {
  const method = patch.fulfillmentMethod ?? cur.fulfillment.method;
  const curF = cur.fulfillment;
  const recipient: Recipient = { ...curF.recipient, ...patch.recipient };
  const cardMessage = patch.cardMessage ?? curF.cardMessage;
  const address: Address | undefined =
    patch.address ?? (curF.method === "delivery" ? curF.address : undefined);
  const window: DeliveryWindow | undefined =
    patch.window ?? (curF.method !== "in-store" ? curF.window : undefined);

  let fulfillment: OrderFulfillment;
  if (method === "in-store") {
    fulfillment = { method: "in-store", recipient, ...(cardMessage ? { cardMessage } : {}) };
  } else if (method === "pickup") {
    if (!window) throw new Error("window required for pickup");
    fulfillment = { method: "pickup", recipient, window, ...(cardMessage ? { cardMessage } : {}) };
  } else {
    if (!address) throw new Error("address required for delivery");
    if (!window) throw new Error("window required for delivery");
    fulfillment = { method: "delivery", recipient, address, window, ...(cardMessage ? { cardMessage } : {}) };
  }

  const lines = patch.lines ?? cur.lines;
  if (lines.length === 0) throw new Error("order must have at least one item");

  const totals = resolveOrderTotals({
    lines,
    fulfillmentMethod: method,
    address: method === "delivery" ? { zip: (address as Address).zip, city: (address as Address).city } : undefined,
    override: patch.totalsOverride,
  });

  return {
    ...cur,
    contact: { ...cur.contact, ...patch.contact },
    fulfillment,
    lines,
    totals,
  };
}

export function diffOrders(before: Order, after: Order): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const push = (field: string, label: string, b: string | null, a: string | null) => {
    if (b !== a) diffs.push({ field, label, before: b, after: a });
  };
  push("contact.name", "Nombre comprador", before.contact.name ?? null, after.contact.name ?? null);
  push("contact.phone", "Teléfono comprador", before.contact.phone, after.contact.phone);
  push("contact.email", "Email comprador", before.contact.email ?? null, after.contact.email ?? null);
  push("recipient.name", "Destinatario", before.fulfillment.recipient.name, after.fulfillment.recipient.name);
  push("recipient.phone", "Tel. destinatario", before.fulfillment.recipient.phone, after.fulfillment.recipient.phone);
  push("fulfillment.method", "Método", before.fulfillment.method, after.fulfillment.method);

  const bAddr = before.fulfillment.method === "delivery" ? before.fulfillment.address : null;
  const aAddr = after.fulfillment.method === "delivery" ? after.fulfillment.address : null;
  const fmtAddr = (x: Address | null) => x ? `${x.street1}, ${x.city}, ${x.state} ${x.zip}` : null;
  push("fulfillment.address", "Dirección", fmtAddr(bAddr), fmtAddr(aAddr));

  const bWin = before.fulfillment.method !== "in-store" ? before.fulfillment.window : null;
  const aWin = after.fulfillment.method !== "in-store" ? after.fulfillment.window : null;
  const fmtWin = (w: DeliveryWindow | null) => w ? `${w.date} · ${w.slot}` : null;
  push("fulfillment.window", "Entrega", fmtWin(bWin), fmtWin(aWin));

  push("cardMessage", "Mensaje de tarjeta", before.fulfillment.cardMessage ?? null, after.fulfillment.cardMessage ?? null);

  if (JSON.stringify(before.lines) !== JSON.stringify(after.lines)) {
    diffs.push({ field: "lines", label: "Artículos", before: linesSummary(before.lines), after: linesSummary(after.lines) });
  }
  push("totals.totalCents", "Total", money(before.totals.totalCents), money(after.totals.totalCents));
  return diffs;
}

export async function editOrder(
  orderId: string,
  patch: OrderEditPatch,
  actor: string,
): Promise<{ order: Order; change: OrderChange | null }> {
  const cur = await getOrder(orderId);
  if (!cur) throw new Error(`order not found: ${orderId}`);
  const next = applyPatch(cur, patch);
  const changes = diffOrders(cur, next);
  if (changes.length === 0) return { order: cur, change: null };

  next.updatedAt = new Date().toISOString();
  await updateOrder(next);

  const labels = changes.map((c) => c.label).join(", ");
  const change = await recordOrderChange({
    orderId, actor, kind: "edit", summary: `Editó: ${labels}`, changes,
  });
  return { order: next, change };
}
