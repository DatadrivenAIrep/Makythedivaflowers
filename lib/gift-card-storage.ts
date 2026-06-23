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
