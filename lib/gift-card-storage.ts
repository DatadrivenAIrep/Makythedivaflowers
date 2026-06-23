import { getDb } from "@/lib/db";
import { generateGiftCardCode, normalizeCode } from "@/lib/gift-card-code";
import type {
  GiftCard,
  GiftCardDisplayStatus,
  GiftCardReason,
  GiftCardRedemption,
} from "@/types/gift-card";

type GiftCardRow = {
  id: string;
  code: string;
  initial_cents: number;
  balance_cents: number;
  status: string;
  recipient_email: string;
  recipient_name: string | null;
  from_label: string | null;
  personal_message: string | null;
  reason: string | null;
  issued_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToCard(r: GiftCardRow): GiftCard {
  return {
    id: r.id,
    code: r.code,
    initialCents: r.initial_cents,
    balanceCents: r.balance_cents,
    status: r.status === "void" ? "void" : "active",
    recipientEmail: r.recipient_email,
    recipientName: r.recipient_name ?? undefined,
    fromLabel: r.from_label ?? undefined,
    personalMessage: r.personal_message ?? undefined,
    reason: (r.reason as GiftCardReason | null) ?? undefined,
    issuedBy: r.issued_by ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type IssueGiftCardInput = {
  initialCents: number;
  recipientEmail: string;
  recipientName?: string;
  fromLabel?: string;
  personalMessage?: string;
  reason?: GiftCardReason;
  issuedBy?: string;
};

export function issueGiftCard(input: IssueGiftCardInput): GiftCard {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  const insert = db.prepare(
    `INSERT INTO gift_cards (
       id, code, initial_cents, balance_cents, status,
       recipient_email, recipient_name, from_label, personal_message,
       reason, issued_by, expires_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // Retry on the (astronomically unlikely) UNIQUE(code) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newId("gc");
    const code = generateGiftCardCode();
    try {
      insert.run(
        id, code, input.initialCents, input.initialCents,
        input.recipientEmail, input.recipientName ?? null, input.fromLabel ?? null,
        input.personalMessage ?? null, input.reason ?? null, input.issuedBy ?? null,
        expires.toISOString(), nowIso, nowIso,
      );
      return getGiftCardById(id)!;
    } catch (e) {
      if (String(e).includes("UNIQUE") && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("could not generate a unique gift card code");
}

export function getGiftCardById(id: string): GiftCard | null {
  const row = getDb().prepare("SELECT * FROM gift_cards WHERE id = ?").get(id) as
    | GiftCardRow
    | undefined;
  return row ? rowToCard(row) : null;
}

export function getGiftCardByCode(code: string): GiftCard | null {
  const normalized = normalizeCode(code);
  const row = getDb().prepare("SELECT * FROM gift_cards WHERE code = ?").get(normalized) as
    | GiftCardRow
    | undefined;
  return row ? rowToCard(row) : null;
}

export function displayStatus(card: {
  status: "active" | "void";
  balanceCents: number;
  initialCents: number;
  expiresAt?: string;
}): GiftCardDisplayStatus {
  if (card.status === "void") return "void";
  if (card.balanceCents <= 0) return "empty";
  if (card.expiresAt && Date.parse(card.expiresAt) < Date.now()) return "expired";
  if (card.balanceCents < card.initialCents) return "partial";
  return "active";
}

export function isRedeemable(card: GiftCard): boolean {
  return displayStatus(card) === "active" || displayStatus(card) === "partial";
}

// --- exported for later tasks; declared here to keep the module cohesive ---
export type { GiftCardRedemption };

export type RedemptionCheck =
  | { ok: true; card: GiftCard; applicableCents: number }
  | { ok: false; reason: "invalid" | "void" | "empty" | "expired" };

export function validateForRedemption(code: string, wantCents: number): RedemptionCheck {
  const card = getGiftCardByCode(code);
  if (!card) return { ok: false, reason: "invalid" };
  if (card.status === "void") return { ok: false, reason: "void" };
  if (card.expiresAt && Date.parse(card.expiresAt) < Date.now())
    return { ok: false, reason: "expired" };
  if (card.balanceCents <= 0) return { ok: false, reason: "empty" };
  return { ok: true, card, applicableCents: Math.min(card.balanceCents, wantCents) };
}

/**
 * Atomically debit `amountCents` from the card for `orderId`.
 * node:sqlite is synchronous so the read-check-write below cannot interleave with
 * another redemption; BEGIN/COMMIT adds rollback safety across the two writes.
 * Throws if the card is gone/void/expired or has insufficient balance.
 */
export function redeem(cardId: string, orderId: string, amountCents: number): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const card = getGiftCardById(cardId);
    if (!card) throw new Error("gift card not found");

    // Idempotent per order: a Stripe webhook retry (or a double-call) must not double-debit.
    const dup = db
      .prepare(
        "SELECT 1 FROM gift_card_redemptions WHERE gift_card_id = ? AND order_id = ? AND type = 'redeem' LIMIT 1",
      )
      .get(cardId, orderId);
    if (dup) {
      db.exec("COMMIT");
      return;
    }

    if (card.status === "void") throw new Error("gift card is void");
    if (card.expiresAt && Date.parse(card.expiresAt) < Date.now())
      throw new Error("gift card expired");
    if (amountCents <= 0) throw new Error("redeem amount must be positive");
    if (card.balanceCents < amountCents) throw new Error("insufficient gift card balance");

    const nowIso = new Date().toISOString();
    db.prepare("UPDATE gift_cards SET balance_cents = balance_cents - ?, updated_at = ? WHERE id = ?")
      .run(amountCents, nowIso, cardId);
    db.prepare(
      `INSERT INTO gift_card_redemptions (id, gift_card_id, order_id, amount_cents, type, created_at)
       VALUES (?, ?, ?, ?, 'redeem', ?)`,
    ).run(newId("gcr"), cardId, orderId, amountCents, nowIso);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Credit balance back when an order paid by gift card is canceled/refunded. Idempotent per order. */
export function refund(cardId: string, orderId: string, amountCents: number): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const card = getGiftCardById(cardId);
    if (!card) throw new Error("gift card not found");

    const already = db
      .prepare(
        "SELECT 1 FROM gift_card_redemptions WHERE gift_card_id = ? AND order_id = ? AND type = 'refund' LIMIT 1",
      )
      .get(cardId, orderId);
    if (already) {
      db.exec("COMMIT");
      return;
    }

    const credit = Math.min(amountCents, card.initialCents - card.balanceCents);
    if (credit <= 0) {
      db.exec("COMMIT");
      return;
    }
    const nowIso = new Date().toISOString();
    db.prepare("UPDATE gift_cards SET balance_cents = balance_cents + ?, updated_at = ? WHERE id = ?")
      .run(credit, nowIso, cardId);
    db.prepare(
      `INSERT INTO gift_card_redemptions (id, gift_card_id, order_id, amount_cents, type, created_at)
       VALUES (?, ?, ?, ?, 'refund', ?)`,
    ).run(newId("gcr"), cardId, orderId, -credit, nowIso);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function voidGiftCard(cardId: string): void {
  getDb()
    .prepare("UPDATE gift_cards SET status = 'void', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), cardId);
}

export type GiftCardStats = {
  activeCount: number;
  pendingCents: number;  // sum of balances on non-void cards = liability
  issuedCents: number;   // sum of initial amounts
  redeemedCents: number; // net of redeem (+) and refund (-) ledger amounts
};

export type GiftCardListItem = GiftCard & { display: GiftCardDisplayStatus };

export function listGiftCards(): { cards: GiftCardListItem[]; stats: GiftCardStats } {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM gift_cards ORDER BY created_at DESC, rowid DESC")
    .all() as GiftCardRow[];
  const cards: GiftCardListItem[] = rows.map((r) => {
    const c = rowToCard(r);
    return { ...c, display: displayStatus(c) };
  });

  const nonVoid = cards.filter((c) => c.status !== "void");
  const pendingCents = nonVoid.reduce((s, c) => s + c.balanceCents, 0);
  const issuedCents = cards.reduce((s, c) => s + c.initialCents, 0);
  const redeemed = db
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM gift_card_redemptions")
    .get() as { n: number };
  const activeCount = cards.filter(
    (c) => c.display === "active" || c.display === "partial",
  ).length;

  return {
    cards,
    stats: { activeCount, pendingCents, issuedCents, redeemedCents: redeemed.n },
  };
}

export function getGiftCardWithHistory(
  id: string,
): { card: GiftCard; redemptions: GiftCardRedemption[] } | null {
  const card = getGiftCardById(id);
  if (!card) return null;
  const rows = getDb()
    .prepare(
      "SELECT * FROM gift_card_redemptions WHERE gift_card_id = ? ORDER BY created_at DESC, rowid DESC",
    )
    .all(id) as {
    id: string;
    gift_card_id: string;
    order_id: string | null;
    amount_cents: number;
    type: string;
    created_at: string;
  }[];
  const redemptions: GiftCardRedemption[] = rows.map((r) => ({
    id: r.id,
    giftCardId: r.gift_card_id,
    orderId: r.order_id ?? undefined,
    amountCents: r.amount_cents,
    type: r.type === "refund" ? "refund" : "redeem",
    createdAt: r.created_at,
  }));
  return { card, redemptions };
}
