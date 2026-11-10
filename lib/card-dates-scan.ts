import "server-only";
// Reads one order's card message and, when it announces a birthday or an
// anniversary, saves that date on the buying customer's profile (source "card").
// Each order is read once: the result lands in card_date_scans, so a date the
// shop deletes never comes back. Nothing here sends a message.
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { withTransaction } from "@/lib/db-tx";
import { readCard } from "@/lib/card-dates";
import type { RelationshipCode } from "@/lib/customer-dates";
import { addImportantDate, findDateByRelationship, findRecipientDate } from "@/lib/customer-dates-storage";
import { getCustomerById } from "@/lib/customer-storage";
import { rowToOrder, type OrderRow } from "@/lib/order-row";
import { isSympathyProduct } from "@/lib/product-add-ons";
import { getPricedProducts } from "@/lib/product-prices";
import { shopDateStr } from "@/lib/tv-slots";
import type { Order } from "@/types/order";

export type ScanOutcome = "saved" | "review" | "duplicate" | "excluded" | "none";

type CardKind = "birthday" | "anniversary";

/** Lowercase, accents stripped, whitespace trimmed and collapsed. */
function nameKey(name: string | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function last10(phone: string | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** Who bought: the order's contact name, else the customer's; and the buyer's phones. */
type Buyer = { name: string; phones: string[] };

/** null when the order's customer does not exist (nothing to save the date on). */
function buyerOf(order: Order): Buyer | null {
  const customer = order.customerId ? getCustomerById(order.customerId) : null;
  if (!customer) return null;
  const phones = [last10(order.contact.phone), last10(customer.phone)].filter((p) => p.length === 10);
  return { name: order.contact.name?.trim() || customer.name, phones };
}

/**
 * The recipient carries the buyer's own name, or no name at all: the order alone
 * does not say who the date is for. When the card gives no relationship either,
 * staff must type the name.
 */
function recipientIsBuyer(order: Order, buyer: Buyer): boolean {
  const recipient = nameKey(order.fulfillment.recipient.name);
  return recipient === "" || recipient === nameKey(buyer.name);
}

type Person = { label?: string; recipientPhone?: string };

/**
 * Step 4: whose date this is. A staff-typed `name` becomes the label. Returns
 * null when nobody can tell: the recipient is the buyer and there is neither a
 * relationship nor a typed name.
 */
function personFor(
  order: Order,
  buyer: Buyer,
  relationship: RelationshipCode | undefined,
  name?: string,
): Person | null {
  const isBuyer = recipientIsBuyer(order, buyer);
  const phone = last10(order.fulfillment.recipient.phone);
  const othersPhone = !isBuyer && phone.length === 10 && !buyer.phones.includes(phone) ? phone : undefined;
  const typed = name?.trim();
  if (typed) return { label: typed, recipientPhone: othersPhone };
  if (isBuyer) return relationship ? {} : null;
  return { label: order.fulfillment.recipient.name.trim(), recipientPhone: othersPhone };
}

type Day = { year: number; month: number; day: number };

function parseYmd(ymd: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/** Step 5: the delivery/pickup day, else the New York day the order was created. */
function dayOf(order: Order): Day {
  const f = order.fulfillment;
  const fromWindow = f.method === "in-store" ? null : parseYmd(f.window.date ?? "");
  const day = fromWindow ?? parseYmd(shopDateStr(new Date(order.createdAt)));
  if (!day) throw new Error("order has no usable date");
  return day;
}

/** Step 6: the birth or wedding year, when the card gave the age or the years. */
function yearFor(day: Day, years: number | undefined): number | undefined {
  return years === undefined ? undefined : day.year - years;
}

/**
 * Step 7: the customer already has this occasion for this person, whatever the
 * day (same rule as rememberRecipientDate). Without a label, the person is the
 * relationship: any date of this kind for that relative counts, named or not.
 */
function isDuplicate(
  customerId: string,
  kind: CardKind,
  person: Person,
  relationship: RelationshipCode | undefined,
): boolean {
  if (person.label) {
    return findRecipientDate(customerId, { name: person.label, phone: person.recipientPhone }, [kind]) !== null;
  }
  // personFor only returns an unnamed person when there is a relationship.
  return relationship !== undefined && findDateByRelationship(customerId, kind, relationship) !== null;
}

type Placement = { kind: CardKind; relationship?: RelationshipCode; years?: number };
type Placed = { outcome: "saved"; dateId: string } | { outcome: "duplicate" } | { outcome: "review" };

/**
 * Steps 4–8 for a known occasion: decide whose date it is, skip a duplicate,
 * save the rest. Runs inside the caller's transaction. Shared with the review
 * resolution, which passes the staff-chosen kind and an optional typed name.
 */
function placeCardDate(order: Order, buyer: Buyer, placement: Placement, now: Date, name?: string): Placed {
  const customerId = order.customerId as string;
  const person = personFor(order, buyer, placement.relationship, name);
  if (!person) return { outcome: "review" };
  if (isDuplicate(customerId, placement.kind, person, placement.relationship)) return { outcome: "duplicate" };
  const day = dayOf(order);
  const dates = addImportantDate(
    customerId,
    {
      kind: placement.kind,
      label: person.label,
      month: day.month,
      day: day.day,
      year: yearFor(day, placement.years),
      recipientPhone: person.recipientPhone,
      source: "card",
      relationship: placement.relationship,
      sourceOrderId: order.id,
    },
    now,
  );
  const created = dates.find((d) => d.sourceOrderId === order.id && d.source === "card");
  if (!created) throw new Error("card date missing after insert");
  return { outcome: "saved", dateId: created.id };
}

/** Funeral orders and orders carrying a sympathy product. Retired products don't count. */
function isSympathyOrder(order: Order): boolean {
  if (order.funeral) return true;
  const catalogIds = order.lines.flatMap((l) => (l.kind === "catalog" ? [l.productId] : []));
  if (catalogIds.length === 0) return false;
  const products = new Map(getPricedProducts().map((p) => [p.id, p]));
  return catalogIds.some((id) => {
    const product = products.get(id);
    return product !== undefined && isSympathyProduct(product);
  });
}

/** An order the scan can read at all: a card, a customer, not canceled or failed. */
function isReadable(order: Order): boolean {
  return (
    (order.fulfillment.cardMessage ?? "").trim() !== "" &&
    Boolean(order.customerId) &&
    order.status !== "canceled" &&
    order.status !== "failed"
  );
}

function alreadyScanned(orderId: string): boolean {
  return getDb().prepare("SELECT 1 FROM card_date_scans WHERE order_id = ?").get(orderId) !== undefined;
}

function recordScan(orderId: string, outcome: ScanOutcome, dateId: string | null, now: Date): void {
  getDb()
    .prepare("INSERT INTO card_date_scans (order_id, outcome, date_id, scanned_at) VALUES (?, ?, ?, ?)")
    .run(orderId, outcome, dateId, now.toISOString());
}

function scanInTransaction(order: Order, now: Date): ScanOutcome | null {
  if (alreadyScanned(order.id)) return null;
  const buyer = buyerOf(order);
  if (!buyer) return null;

  const reading = readCard(order.fulfillment.cardMessage ?? "");
  if (isSympathyOrder(order) || reading.result === "memorial") {
    recordScan(order.id, "excluded", null, now);
    return "excluded";
  }
  if (reading.result === "none" || reading.result === "review") {
    recordScan(order.id, reading.result, null, now);
    return reading.result;
  }

  const placed = placeCardDate(order, buyer, reading, now);
  recordScan(order.id, placed.outcome, placed.outcome === "saved" ? placed.dateId : null, now);
  return placed.outcome;
}

/** null: the order is not readable yet (no card, no customer, canceled/failed) or was already read. Nothing is recorded then. */
export function scanOrderForDates(order: Order, now: Date = new Date()): ScanOutcome | null {
  if (!isReadable(order)) return null;
  // Outside the transaction: a migration opens its own, which cannot nest.
  runMigrations();
  // BEGIN IMMEDIATE: two scans of the same order serialize on the "already read" check.
  return withTransaction(() => scanInTransaction(order, now));
}

function loadOrder(orderId: string): Order | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}

/**
 * The error's message with any quoted fragment blanked: a parser error can quote
 * the text it choked on, and the log must never carry card text or names.
 */
function safeErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "non-error thrown";
  return message.replace(/"[^"]*"|'[^']*'/g, "…").slice(0, 200);
}

/** Loads the order by id and scans it. Never throws; logs card_dates_scan_failed with the orderId only. */
export function scanOrderByIdSafe(orderId: string): void {
  try {
    const order = loadOrder(orderId);
    if (order) scanOrderForDates(order);
  } catch (e) {
    console.error(JSON.stringify({ event: "card_dates_scan_failed", orderId, error: safeErrorMessage(e) }));
  }
}
