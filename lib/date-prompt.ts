import "server-only";
import type { CatalogCartLine, Order } from "@/types/order";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { e164 } from "@/lib/twilio-server";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { getPricedProducts } from "@/lib/product-prices";
import { isSympathyProduct } from "@/lib/product-add-ons";
import { inHoliday } from "@/lib/date-suggestions";
import { listFuneralHomes } from "@/lib/funeral-homes";
import { sameAddress } from "@/lib/address-key";
import { findRecipientDate } from "@/lib/customer-dates-storage";
import { getDatePreferences, preferencesForRecipient, type DatePreferences } from "@/lib/date-preferences-storage";
import { bonusSlotFree, type BonusSlot } from "@/lib/loyalty-bonus";
import { loyaltyEnabled, lookupCustomer } from "@/lib/loyalty-client";

/**
 * What to ask on the order confirmation page: one question per order, and which
 * reward line can honestly be promised. The question logic is pure decisions over
 * the order and the DB; nothing here saves anything.
 */

export type DatePromptQuestion =
  | { kind: "date"; recipientName: string; prefill: { month: number; day: number } | null }
  | { kind: "likes"; dateId: string; recipientName: string; prefill: DatePreferences | null };

export type PromptReward = { kind: "reward"; reward: string } | { kind: "stamp" } | null;

const MAX_AGE_MS = 30 * 24 * 3600_000;
const DEFAULT_REWARD_TIMEOUT_MS = 3000;

function db() {
  runMigrations();
  return getDb();
}

function folded(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A web order never carries the shop's funeral flag, so the product tags alone
 * would decide. Two more signs of a funeral: the delivery goes to a funeral home
 * the shop has saved, or the recipient is one ("Funeraria San José", "Smith Funeral Home").
 */
function looksLikeFuneral(order: Order): boolean {
  const recipient = folded(order.fulfillment.recipient.name);
  if (recipient.includes("funeral") || recipient.includes("funeraria")) return true;
  if (order.fulfillment.method !== "delivery") return false;
  const address = order.fulfillment.address;
  if (!address?.street1?.trim()) return false;
  return listFuneralHomes().some((h) => sameAddress(h.address, address));
}

function last10(phone: string | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export function orderQualifiesForPrompt(order: Order, now: Date = new Date()): boolean {
  if (!dateRewardsEnabled()) return false;
  if (order.paymentStatus !== "paid" || order.status === "canceled") return false;
  const created = Date.parse(order.createdAt);
  if (!Number.isFinite(created) || now.getTime() - created > MAX_AGE_MS) return false;
  if (!order.customerId || order.source !== "web" || order.funeral) return false;

  if (looksLikeFuneral(order)) return false;

  const products = new Map(getPricedProducts().map((p) => [p.id, p]));
  const catalogLines = order.lines.filter((l): l is CatalogCartLine => l.kind === "catalog");
  // A product no longer in the catalog may have been a sympathy piece: we cannot
  // tell, so the order is treated as one (same rule as the Mis fechas suggestions).
  if (catalogLines.some((l) => !products.has(l.productId))) return false;
  const catalog = catalogLines.flatMap((l) => {
    const p = products.get(l.productId);
    return p ? [p] : [];
  });
  if (catalog.some(isSympathyProduct)) return false;
  if (catalog.some((p) => p.subscription || p.category === "subscriptions")) return false;
  // Get-well flowers are not for celebrating: skip when every product is one.
  const getWell = (p: (typeof catalog)[number]) => p.occasions.length > 0 && p.occasions.every((o) => o === "get-well");
  if (catalog.length > 0 && catalog.every(getWell)) return false;

  const answered = db().prepare("SELECT 1 FROM date_prompt_answers WHERE order_id = ?").get(order.id);
  return !answered;
}

export function promptQuestion(order: Order, now: Date = new Date()): DatePromptQuestion | null {
  if (!order.customerId || !orderQualifiesForPrompt(order, now)) return null;
  const recipient = order.fulfillment.recipient;
  const name = recipient.name.trim();
  if (!name) return null;
  // Flowers for themselves (same phone as the buyer) say nothing about someone they love.
  const own = last10(recipient.phone);
  if (own !== "" && own === last10(order.contact.phone)) return null;
  const who = { name, phone: recipient.phone };

  const date = findRecipientDate(order.customerId, who, ["birthday", "anniversary"]);
  if (!date) {
    let prefill: { month: number; day: number } | null = null;
    if (order.fulfillment.method !== "in-store") {
      const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(order.fulfillment.window.date);
      if (m) {
        const month = Number(m[1]);
        const day = Number(m[2]);
        if (!inHoliday(month, day)) prefill = { month, day };
      }
    }
    return { kind: "date", recipientName: name, prefill };
  }
  const prefs = getDatePreferences(date.id);
  if (prefs.flowers.length === 0 && prefs.colors.length === 0) {
    return { kind: "likes", dateId: date.id, recipientName: name, prefill: preferencesForRecipient(order.customerId, who) };
  }
  return null;
}

function syncPending(orderId: string): boolean {
  return Boolean(
    db().prepare("SELECT 1 FROM loyalty_sync WHERE order_id = ? AND kind = 'sync' AND status = 'pending'").get(orderId),
  );
}

async function rewardFor(order: Order, slot: BonusSlot, timeoutMs: number): Promise<PromptReward> {
  if (!order.customerId || !bonusSlotFree(order.customerId, slot) || !loyaltyEnabled()) return null;
  const card = await lookupCustomer(e164(order.contact.phone), { timeoutMs });
  const pending = syncPending(order.id);
  if (!card) return order.loyaltyJoin && pending ? { kind: "stamp" } : null;
  const next = card.rewards.next;
  if (!next) return { kind: "stamp" };
  // This order's own stamp is still on its way: count it before promising the reward.
  const remaining = next.remaining - (pending ? 1 : 0);
  return remaining === 1 ? { kind: "reward", reward: next.reward } : { kind: "stamp" };
}

/** Which reward line the page can promise for this slot. Never throws; null on any error or timeout. */
export async function promptReward(
  order: Order,
  slot: BonusSlot,
  opts: { timeoutMs?: number } = {},
): Promise<PromptReward> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_REWARD_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([rewardFor(order, slot, timeoutMs), timeout]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
