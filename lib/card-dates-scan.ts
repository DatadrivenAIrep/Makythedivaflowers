import "server-only";
// Reads one order's card message and, when it announces a birthday or an
// anniversary, saves that date on the buying customer's profile (source "card").
// Each order is read once: the result lands in card_date_scans, so a date the
// shop deletes never comes back. Nothing here sends a message.
import { getDb } from "@/lib/db";
import { errorClass } from "@/lib/card-dates-log";
import { runMigrations } from "@/lib/db-migrate";
import { inTransaction, withTransaction } from "@/lib/db-tx";
import { isValidPersonName } from "@/lib/account-dates";
import { readCard, yearsInRange, type CardReading } from "@/lib/card-dates";
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
    if (findRecipientDate(customerId, { name: person.label, phone: person.recipientPhone }, [kind]) !== null) return true;
    // Symmetric rule: an unnamed date for the same relative (made from an earlier
    // card) is the same person even when this card names her.
    if (relationship === undefined) return false;
    return findDateByRelationship(customerId, kind, relationship, { unnamedOnly: true }) !== null;
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

/** Loads the order by id and scans it. Never throws; logs card_dates_scan_failed with the orderId only. */
export function scanOrderByIdSafe(orderId: string): void {
  try {
    const order = loadOrder(orderId);
    if (order) scanOrderForDates(order);
  } catch (e) {
    console.error(JSON.stringify({ event: "card_dates_scan_failed", orderId, error: errorClass(e) }));
  }
}

// ── History, preview and review ─────────────────────────────────────────────

export type CardScanReport = {
  scanned: number;
  saved: number;
  review: number;
  duplicate: number;
  excluded: number;
  none: number;
  /** Orders that could not be read this time; they get no row and are retried next run. */
  failed: number;
};
export type CardScanPreview = { pendingOrders: number; wouldSave: number; wouldReview: number; unlinkedOrders: number };
export type CardReview = {
  orderId: string;
  orderNumber?: number;
  customerId: string;
  customerName: string;
  recipientName: string;
  cardMessage: string;
  month: number;
  day: number;
  relationship?: RelationshipCode;
  years?: number;
  /** The recipient is the buyer: staff must type who it is for. */
  needsName: boolean;
};

/** SQL for "has a card": not null and not only spaces, tabs or line breaks. */
const HAS_CARD = "o.card_message IS NOT NULL AND TRIM(o.card_message, char(32, 9, 10, 13)) <> ''";
const READABLE_STATUS = "o.fulfillment_status NOT IN ('canceled', 'failed')";

/**
 * Reads every order not read yet, oldest first: a card, a customer that still
 * exists, not canceled or failed. Each order commits on its own (or joins the
 * caller's transaction). Counts only orders that were actually read.
 *
 * An order that throws is logged by id, counted in `failed` and given no scan
 * row, so the next run tries it again; the rest of the history still runs. Its
 * own transaction rolls its writes back before the catch (inside the preview,
 * the preview's rollback does).
 */
export function scanPendingCardDates(now: Date = new Date()): CardScanReport {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT o.* FROM orders o
         JOIN customers c ON c.id = o.customer_id
         LEFT JOIN card_date_scans s ON s.order_id = o.id
        WHERE s.order_id IS NULL AND ${HAS_CARD} AND ${READABLE_STATUS}
        ORDER BY o.created_at, o.id`,
    )
    .all() as OrderRow[];
  const report: CardScanReport = { scanned: 0, saved: 0, review: 0, duplicate: 0, excluded: 0, none: 0, failed: 0 };
  for (const row of rows) {
    let outcome: ScanOutcome | null;
    try {
      outcome = scanOrderForDates(rowToOrder(row), now);
    } catch (e) {
      console.error(JSON.stringify({ event: "card_dates_scan_failed", orderId: row.id, error: errorClass(e) }));
      report.failed += 1;
      continue;
    }
    if (outcome === null) continue;
    report.scanned += 1;
    report[outcome] += 1;
  }
  return report;
}

/** Orders with a card that would be read once linked to a customer. */
function countUnlinkedOrders(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM orders o WHERE o.customer_id IS NULL AND o.payment_status = 'paid' AND o.contact_phone <> '' AND ${HAS_CARD} AND ${READABLE_STATUS}`)
    .get() as { n: number };
  return row.n;
}

/** Thrown only to undo the preview's run. */
class PreviewRollback extends Error {}

/**
 * What scanPendingCardDates would do now, without keeping any of it: the same
 * run inside one transaction that is always rolled back. Refuses to run inside
 * another transaction, where its writes would join that one and survive.
 */
export function previewCardScan(now: Date = new Date()): CardScanPreview {
  if (inTransaction()) throw new Error("previewCardScan must not run inside a transaction");
  runMigrations();
  let report: CardScanReport | undefined;
  try {
    withTransaction(() => {
      report = scanPendingCardDates(now);
      throw new PreviewRollback();
    });
  } catch (e) {
    if (!(e instanceof PreviewRollback)) throw e;
  }
  if (!report) throw new Error("card scan preview did not run");
  return {
    pendingOrders: report.scanned,
    wouldSave: report.saved,
    wouldReview: report.review,
    unlinkedOrders: countUnlinkedOrders(),
  };
}

/** The relationship and years the card gives, if any. */
function cluesOf(reading: CardReading): { relationship?: RelationshipCode; years?: number } {
  if (reading.result !== "date" && reading.result !== "review") return {};
  return {
    ...(reading.relationship ? { relationship: reading.relationship } : {}),
    ...(reading.years !== undefined ? { years: reading.years } : {}),
  };
}

/** The orders left in review, oldest first, read fresh from the order and its customer. */
export function listCardReviews(): CardReview[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT o.*, c.name AS review_customer_name FROM card_date_scans s
         JOIN orders o ON o.id = s.order_id
         JOIN customers c ON c.id = o.customer_id
        WHERE s.outcome = 'review'
        ORDER BY o.created_at, o.id`,
    )
    .all() as Array<OrderRow & { review_customer_name: string }>;
  const reviews: CardReview[] = [];
  for (const row of rows) {
    try {
      const review = reviewOf(row);
      if (review) reviews.push(review);
    } catch {
      // One unreadable order must not hide the rest; log the id only.
      console.error(JSON.stringify({ event: "card_dates_review_row_failed", orderId: row.id }));
    }
  }
  return reviews;
}

function reviewOf(row: OrderRow & { review_customer_name: string }): CardReview | null {
  const order = rowToOrder(row);
  const buyer = buyerOf(order);
  if (!buyer) return null;
  const cardMessage = order.fulfillment.cardMessage ?? "";
  const clues = cluesOf(readCard(cardMessage));
  const day = dayOf(order);
  return {
    orderId: order.id,
    ...(order.orderNumber !== undefined ? { orderNumber: order.orderNumber } : {}),
    customerId: order.customerId as string,
    customerName: row.review_customer_name,
    recipientName: order.fulfillment.recipient.name,
    cardMessage,
    month: day.month,
    day: day.day,
    ...clues,
    needsName: recipientIsBuyer(order, buyer) && !clues.relationship,
  };
}

function setOutcome(orderId: string, outcome: "saved" | "duplicate" | "dismissed", dateId: string | null): void {
  getDb()
    .prepare("UPDATE card_date_scans SET outcome = ?, date_id = ? WHERE order_id = ? AND outcome = 'review'")
    .run(outcome, dateId, orderId);
}

/**
 * Staff settle an order left in review: save it as a birthday or anniversary
 * (with a typed name when the card does not say who it is for), or dismiss it.
 * The order's scan row is updated in place; it is never read again.
 */
export function resolveCardReview(
  orderId: string,
  choice: { kind: "birthday" | "anniversary"; name?: string } | "dismiss",
  now: Date = new Date(),
): "saved" | "duplicate" | "dismissed" | "name_required" | "not_found" {
  runMigrations();
  return withTransaction(() => {
    const scan = getDb().prepare("SELECT outcome FROM card_date_scans WHERE order_id = ?").get(orderId) as
      | { outcome: string }
      | undefined;
    if (scan?.outcome !== "review") return "not_found";
    if (choice === "dismiss") {
      setOutcome(orderId, "dismissed", null);
      return "dismissed";
    }

    const name = choice.name?.trim() || undefined;
    if (name !== undefined && !isValidPersonName(name)) return "name_required";

    const order = loadOrder(orderId);
    const buyer = order ? buyerOf(order) : null;
    if (!order || !buyer) return "not_found";

    const { relationship, years } = cluesOf(readCard(order.fulfillment.cardMessage ?? ""));
    // A review reading allows a birthday's range; the chosen occasion may allow less.
    const placement = { kind: choice.kind, relationship, years: yearsInRange(years, choice.kind) };
    const placed = placeCardDate(order, buyer, placement, now, name);
    if (placed.outcome === "review") return "name_required";
    setOutcome(orderId, placed.outcome, placed.outcome === "saved" ? placed.dateId : null);
    return placed.outcome;
  });
}
