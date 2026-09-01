import { getDb } from "@/lib/db";

/**
 * Promotional discount codes.
 *
 * Deliberately separate from gift cards: a gift card is stored value the buyer
 * already paid for and draws down, so its guard is a balance. A promo code is a
 * discount the shop grants, so its guards are a redemption count, a date window,
 * a minimum order, and whether the buyer has ordered before.
 *
 * Two-step by design, mirroring `lib/gift-card-storage.ts`:
 *   - `validatePromo` at checkout time, to price the order and show the buyer
 *   - `redeemPromo` at payment time, so an abandoned checkout never burns a code
 */

export type PromoKind = "percent" | "fixed" | "free_delivery";

export type Promo = {
  id: string;
  code: string;
  kind: PromoKind;
  value: number;
  minSubtotalCents?: number;
  maxRedemptions?: number;
  firstOrderOnly: boolean;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type PromoListItem = Promo & {
  redemptionCount: number;
  discountedCents: number;
};

type PromoRow = {
  id: string;
  code: string;
  kind: string;
  value: number;
  min_subtotal_cents: number | null;
  max_redemptions: number | null;
  first_order_only: number;
  active: number;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function rowToPromo(r: PromoRow): Promo {
  return {
    id: r.id,
    code: r.code,
    kind: r.kind as PromoKind,
    value: r.value,
    minSubtotalCents: r.min_subtotal_cents ?? undefined,
    maxRedemptions: r.max_redemptions ?? undefined,
    firstOrderOnly: r.first_order_only === 1,
    active: r.active === 1,
    startsAt: r.starts_at ?? undefined,
    endsAt: r.ends_at ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Entry is forgiving: people paste codes with stray spaces and in any case. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type CreatePromoInput = {
  code: string;
  kind: PromoKind;
  value: number;
  minSubtotalCents?: number;
  maxRedemptions?: number;
  firstOrderOnly?: boolean;
  startsAt?: string;
  endsAt?: string;
  note?: string;
};

export function createPromo(input: CreatePromoInput): Promo {
  const code = normalizePromoCode(input.code);
  if (!code) throw new Error("promo code is required");
  if (input.kind === "percent" && (input.value < 1 || input.value > 100)) {
    throw new Error("percent must be between 1 and 100");
  }
  if (input.kind === "fixed" && input.value <= 0) {
    throw new Error("fixed amount must be positive");
  }
  if (input.maxRedemptions !== undefined && input.maxRedemptions < 1) {
    throw new Error("maxRedemptions must be at least 1");
  }

  const id = newId("promo");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO promo_codes (
         id, code, kind, value, min_subtotal_cents, max_redemptions,
         first_order_only, active, starts_at, ends_at, note, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      code,
      input.kind,
      input.value,
      input.minSubtotalCents ?? null,
      input.maxRedemptions ?? null,
      input.firstOrderOnly ? 1 : 0,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.note ?? null,
      now,
      now,
    );
  return getPromoById(id)!;
}

export function getPromoById(id: string): Promo | null {
  const row = getDb().prepare("SELECT * FROM promo_codes WHERE id = ?").get(id) as
    | PromoRow
    | undefined;
  return row ? rowToPromo(row) : null;
}

export function getPromoByCode(code: string): Promo | null {
  const row = getDb()
    .prepare("SELECT * FROM promo_codes WHERE code = ?")
    .get(normalizePromoCode(code)) as PromoRow | undefined;
  return row ? rowToPromo(row) : null;
}

export function setPromoActive(id: string, active: boolean): void {
  getDb()
    .prepare("UPDATE promo_codes SET active = ?, updated_at = ? WHERE id = ?")
    .run(active ? 1 : 0, new Date().toISOString(), id);
}

export function redemptionCount(promoId: string): number {
  const r = getDb()
    .prepare("SELECT COUNT(*) AS n FROM promo_redemptions WHERE promo_id = ?")
    .get(promoId) as { n: number };
  return r.n;
}

/** What the order looks like at the moment the code is applied. */
export type PromoContext = {
  subtotalCents: number;
  deliveryCents: number;
  /** True when this buyer already has a paid order — gates first-order codes. */
  buyerHasOrdered?: boolean;
};

/**
 * Value of this promo against a given order, in cents.
 *
 * Percent and fixed discounts come off the subtotal only, never the delivery
 * fee — a percentage of shipping is not what "10% off" means to a buyer, and it
 * would quietly erode the delivery margin. Free delivery is the exception and is
 * worth exactly the fee, which is zero on a pickup order.
 */
export function discountForPromo(promo: Promo, ctx: PromoContext): number {
  switch (promo.kind) {
    case "percent":
      return Math.min(Math.round((ctx.subtotalCents * promo.value) / 100), ctx.subtotalCents);
    case "fixed":
      return Math.min(promo.value, ctx.subtotalCents);
    case "free_delivery":
      return ctx.deliveryCents;
    default:
      return 0;
  }
}

export type PromoRejection =
  | "invalid"
  | "inactive"
  | "not_started"
  | "expired"
  | "below_minimum"
  | "exhausted"
  | "not_first_order"
  | "no_discount";

export type PromoCheck =
  | { ok: true; promo: Promo; discountCents: number }
  | { ok: false; reason: PromoRejection; minSubtotalCents?: number };

export function validatePromo(code: string, ctx: PromoContext): PromoCheck {
  const promo = getPromoByCode(code);
  if (!promo) return { ok: false, reason: "invalid" };
  if (!promo.active) return { ok: false, reason: "inactive" };

  const now = Date.now();
  if (promo.startsAt && Date.parse(promo.startsAt) > now) {
    return { ok: false, reason: "not_started" };
  }
  if (promo.endsAt && Date.parse(promo.endsAt) < now) {
    return { ok: false, reason: "expired" };
  }
  if (promo.minSubtotalCents !== undefined && ctx.subtotalCents < promo.minSubtotalCents) {
    // Carry the threshold so the UI can say "spend $75" instead of "invalid".
    return { ok: false, reason: "below_minimum", minSubtotalCents: promo.minSubtotalCents };
  }
  if (promo.maxRedemptions !== undefined && redemptionCount(promo.id) >= promo.maxRedemptions) {
    return { ok: false, reason: "exhausted" };
  }
  if (promo.firstOrderOnly && ctx.buyerHasOrdered) {
    return { ok: false, reason: "not_first_order" };
  }

  const discountCents = discountForPromo(promo, ctx);
  if (discountCents <= 0) return { ok: false, reason: "no_discount" };

  return { ok: true, promo, discountCents };
}

/**
 * Record that `orderId` used this promo. Called once the order is actually paid.
 *
 * Idempotent per order via UNIQUE(promo_id, order_id): a retried Stripe webhook
 * inserts nothing the second time. The limit is re-checked here rather than
 * trusting the earlier validate, because two checkouts can both validate a
 * last-remaining code before either one pays.
 */
export function redeemPromo(promoId: string, orderId: string, amountCents: number): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const already = db
      .prepare("SELECT 1 FROM promo_redemptions WHERE promo_id = ? AND order_id = ? LIMIT 1")
      .get(promoId, orderId);
    if (already) {
      db.exec("COMMIT");
      return;
    }

    const promo = getPromoById(promoId);
    if (!promo) throw new Error("promo not found");
    if (promo.maxRedemptions !== undefined) {
      const used = (
        db
          .prepare("SELECT COUNT(*) AS n FROM promo_redemptions WHERE promo_id = ?")
          .get(promoId) as { n: number }
      ).n;
      if (used >= promo.maxRedemptions) throw new Error("promo redemption limit reached");
    }

    db.prepare(
      `INSERT INTO promo_redemptions (id, promo_id, order_id, amount_cents, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(newId("pr"), promoId, orderId, amountCents, new Date().toISOString());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listPromos(): PromoListItem[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM promo_codes ORDER BY created_at DESC, rowid DESC")
    .all() as PromoRow[];
  const stats = db
    .prepare(
      `SELECT promo_id, COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents
         FROM promo_redemptions GROUP BY promo_id`,
    )
    .all() as { promo_id: string; n: number; cents: number }[];
  const byId = new Map(stats.map((s) => [s.promo_id, s]));

  return rows.map((r) => {
    const p = rowToPromo(r);
    const s = byId.get(p.id);
    return {
      ...p,
      redemptionCount: s?.n ?? 0,
      discountedCents: s?.cents ?? 0,
    };
  });
}
