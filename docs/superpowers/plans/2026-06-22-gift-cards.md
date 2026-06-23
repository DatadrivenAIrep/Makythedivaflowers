# Gift Cards Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a store-issued gift card program — issue $150 courtesy cards from the admin dashboard, email them to a recipient, and redeem them by code at checkout (web + intake) with stored-value (draw-down) balance.

**Architecture:** New SQLite tables `gift_cards` (balance is source of truth) + `gift_card_redemptions` (audit ledger), both mutated together inside `BEGIN`/`COMMIT`. A new Admin → Gift Cards section issues + emails cards via the existing Resend pipeline. At checkout the code is validated server-side and applied as **tender** (tax stays on the full order; the gift card reduces the amount charged). The balance is debited only when the order is actually paid (webhook for partial Stripe charges; inline for $0 full-coverage and immediately-paid intake). Foundation is origin-agnostic so Phase 2 (selling cards) reuses it.

**Tech Stack:** Next.js App Router, TypeScript, `node:sqlite` (synchronous), Zod, Resend, Stripe, Vitest + @testing-library/react, next-intl.

**Spec:** `docs/superpowers/specs/2026-06-22-gift-cards-design.md`. Approved visual mockups live in `.superpowers/brainstorm/15641-1782184528/content/` (`emitir-form.html`, `email-design.html` direction B, `canje-checkout.html`, `gestion.html`) — use them as the source of truth for exact styling of the UI/email.

**Conventions reused (verified in codebase):**
- DB handle: `import { getDb } from "@/lib/db";` → `getDb().prepare(sql).run/get/all(...)`, `getDb().exec("BEGIN"|"COMMIT"|"ROLLBACK")`. `node:sqlite` is synchronous + single-threaded, so a read-check-write inside one function never interleaves with another; `BEGIN`/`COMMIT` is used for atomic multi-statement durability + rollback.
- Migrations: drop a `db/migrations/00N_*.sql` file; `lib/db-migrate.ts` auto-discovers (sorted), runs once, wrapped in a transaction. Next number is **009**.
- Order ⇄ row mapping lives in `lib/order-row.ts` (`OrderRow`, `orderToRow`, `rowToOrder`); the upsert SQL is in `lib/order-storage.ts`.
- Tests: Vitest. Run all: `NODE_OPTIONS='--experimental-sqlite' npx vitest run <file>`. Storage tests stub an in-memory DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`, `closeDb()` + `vi.unstubAllEnvs()` in `afterEach`. Config: jsdom env, `@` alias, setup `tests/setup.ts`.
- Admin API routes: `export const runtime = "nodejs"`, validate with `zod.safeParse`, return `NextResponse.json`. Auth is enforced for all `/api/admin/*` by `proxy.ts` middleware — routes get auth for free. Operator identity is hardcoded `"maky"` today (see `takenBy: "maky"` in intake); use the same for `issued_by`.
- Money: integer cents everywhere. Display `$${(cents/100).toFixed(2)}`.

---

## Milestone A — Issue & email gift cards (shippable on its own)

After Milestone A you can issue a $150 card from the dashboard, it emails the recipient, and you can list/void/resend cards. Redemption comes in Milestone B.

---

### Task 1: Database migration (schema)

**Files:**
- Create: `db/migrations/009_gift_cards.sql`
- Test: `tests/unit/gift-card-migration.test.ts`

- [ ] **Step 1: Write the migration SQL**

`db/migrations/009_gift_cards.sql`:

```sql
-- Gift cards: store-issued courtesy cards with stored-value (draw-down) balance.
-- balance_cents on the row is the source of truth; gift_card_redemptions is the audit ledger.
CREATE TABLE IF NOT EXISTS gift_cards (
  id               TEXT PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,        -- canonical form WITH dashes, uppercase: e.g. DIVA-7K2M-9XQ4
  initial_cents    INTEGER NOT NULL CHECK(initial_cents > 0),
  balance_cents    INTEGER NOT NULL CHECK(balance_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'void'
  recipient_email  TEXT NOT NULL,
  recipient_name   TEXT,
  from_label       TEXT,
  personal_message TEXT,
  reason           TEXT,                         -- loyalty | apology | prize | marketing | other
  issued_by        TEXT,
  expires_at       TEXT,                         -- ISO; issuance + 1 year
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id            TEXT PRIMARY KEY,
  gift_card_id  TEXT NOT NULL REFERENCES gift_cards(id),
  order_id      TEXT,
  amount_cents  INTEGER NOT NULL,               -- positive = redeem (debit), negative = refund (credit)
  type          TEXT NOT NULL,                   -- 'redeem' | 'refund'
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gcr_card ON gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gcr_order ON gift_card_redemptions(order_id);

-- Order columns used in Milestone B (harmless to add now).
ALTER TABLE orders ADD COLUMN gift_card_id TEXT;
ALTER TABLE orders ADD COLUMN gift_card_cents INTEGER;
```

- [ ] **Step 2: Write the failing test**

`tests/unit/gift-card-migration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-mig-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function cols(table: string): string[] {
  return (getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (r) => r.name,
  );
}

describe("migration 009_gift_cards", () => {
  it("creates gift_cards with the expected columns", () => {
    const c = cols("gift_cards");
    for (const name of [
      "id", "code", "initial_cents", "balance_cents", "status",
      "recipient_email", "recipient_name", "from_label", "personal_message",
      "reason", "issued_by", "expires_at", "created_at", "updated_at",
    ]) {
      expect(c).toContain(name);
    }
  });

  it("creates gift_card_redemptions with the expected columns", () => {
    const c = cols("gift_card_redemptions");
    for (const name of ["id", "gift_card_id", "order_id", "amount_cents", "type", "created_at"]) {
      expect(c).toContain(name);
    }
  });

  it("adds gift_card columns to orders", () => {
    const c = cols("orders");
    expect(c).toContain("gift_card_id");
    expect(c).toContain("gift_card_cents");
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-migration.test.ts`
Expected: PASS (the migration runs automatically inside `runMigrations()`).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/009_gift_cards.sql tests/unit/gift-card-migration.test.ts
git commit -m "feat(gift-cards): add 009 migration for gift_cards + redemptions"
```

---

### Task 2: Gift card code generator

**Files:**
- Create: `lib/gift-card-code.ts`
- Test: `tests/unit/gift-card-code.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-code.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateGiftCardCode, normalizeCode, GIFT_CARD_ALPHABET } from "@/lib/gift-card-code";

describe("generateGiftCardCode", () => {
  it("matches DIVA-XXXX-XXXX with the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGiftCardCode();
      expect(code).toMatch(/^DIVA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      const body = code.slice(5).replace("-", "");
      for (const ch of body) expect(GIFT_CARD_ALPHABET).toContain(ch);
    }
  });

  it("never uses ambiguous characters 0 O 1 I L", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGiftCardCode();
      expect(code.slice(5)).not.toMatch(/[01OIL]/);
    }
  });
});

describe("normalizeCode", () => {
  it("uppercases, strips spaces, and re-inserts dashes", () => {
    expect(normalizeCode("diva 7k2m 9xq4")).toBe("DIVA-7K2M-9XQ4");
    expect(normalizeCode("DIVA7K2M9XQ4")).toBe("DIVA-7K2M-9XQ4");
    expect(normalizeCode("  diva-7k2m-9xq4  ")).toBe("DIVA-7K2M-9XQ4");
  });

  it("returns the input uppercased/trimmed when it does not look like a gift card code", () => {
    expect(normalizeCode("hello")).toBe("HELLO");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-code.test.ts`
Expected: FAIL with "Cannot find module '@/lib/gift-card-code'".

- [ ] **Step 3: Write the implementation**

`lib/gift-card-code.ts`:

```typescript
// Crockford-ish alphabet: no 0/O/1/I/L so codes are easy to read aloud and type.
export const GIFT_CARD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomGroup(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * GIFT_CARD_ALPHABET.length);
    out += GIFT_CARD_ALPHABET[idx];
  }
  return out;
}

/** Generates a canonical code like DIVA-7K2M-9XQ4. Uniqueness is enforced by the caller (DB UNIQUE + retry). */
export function generateGiftCardCode(): string {
  return `DIVA-${randomGroup(4)}-${randomGroup(4)}`;
}

/**
 * Normalizes user-typed input to the canonical stored form.
 * "diva 7k2m 9xq4" / "DIVA7K2M9XQ4" → "DIVA-7K2M-9XQ4".
 * Non-matching input is just uppercased/trimmed (lookup will miss → invalid code).
 */
export function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const m = cleaned.match(/^DIVA([0-9A-Z]{4})([0-9A-Z]{4})$/);
  if (m) return `DIVA-${m[1]}-${m[2]}`;
  return input.trim().toUpperCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-code.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gift-card-code.ts tests/unit/gift-card-code.test.ts
git commit -m "feat(gift-cards): code generator + normalizer"
```

---

### Task 3: Gift card types

**Files:**
- Create: `types/gift-card.ts`

- [ ] **Step 1: Write the types**

`types/gift-card.ts`:

```typescript
export type GiftCardStatus = "active" | "void";

export type GiftCardReason = "loyalty" | "apology" | "prize" | "marketing" | "other";

export type GiftCard = {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  status: GiftCardStatus;
  recipientEmail: string;
  recipientName?: string;
  fromLabel?: string;
  personalMessage?: string;
  reason?: GiftCardReason;
  issuedBy?: string;
  expiresAt?: string; // ISO
  createdAt: string;
  updatedAt: string;
};

export type GiftCardRedemption = {
  id: string;
  giftCardId: string;
  orderId?: string;
  amountCents: number; // + redeem, - refund
  type: "redeem" | "refund";
  createdAt: string;
};

/** Derived label for the admin list. */
export type GiftCardDisplayStatus =
  | "active"
  | "partial"
  | "empty"
  | "expired"
  | "void";

/** Safe shape returned to the (untrusted) checkout client — never internal notes/recipient. */
export type GiftCardPublic = {
  code: string;
  balanceCents: number;
  expiresAt?: string;
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors from `types/gift-card.ts`.

- [ ] **Step 3: Commit**

```bash
git add types/gift-card.ts
git commit -m "feat(gift-cards): domain types"
```

---

### Task 4: Storage — issue + lookup

**Files:**
- Create: `lib/gift-card-storage.ts`
- Test: `tests/unit/gift-card-storage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardByCode, displayStatus } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-store-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("issueGiftCard", () => {
  it("creates an active card with full balance and a 1-year expiry", () => {
    const card = issueGiftCard({
      initialCents: 15000,
      recipientEmail: "maria@example.com",
      recipientName: "María",
      fromLabel: "Maky · Diva Flowers",
      personalMessage: "¡Gracias!",
      reason: "loyalty",
      issuedBy: "maky",
    });
    expect(card.code).toMatch(/^DIVA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(card.initialCents).toBe(15000);
    expect(card.balanceCents).toBe(15000);
    expect(card.status).toBe("active");
    expect(card.recipientEmail).toBe("maria@example.com");
    expect(card.expiresAt).toBeTruthy();
    // ~1 year out
    const days = (Date.parse(card.expiresAt!) - Date.parse(card.createdAt)) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(372);
  });

  it("is retrievable by code, normalizing messy input", () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const lower = card.code.toLowerCase().replace(/-/g, " ");
    const found = getGiftCardByCode(lower);
    expect(found?.id).toBe(card.id);
  });

  it("returns null for an unknown code", () => {
    expect(getGiftCardByCode("DIVA-0000-0000")).toBeNull();
  });
});

describe("displayStatus", () => {
  it("maps balance/status/expiry to a display label", () => {
    const base = { status: "active" as const, initialCents: 15000, expiresAt: "2999-01-01T00:00:00Z" };
    expect(displayStatus({ ...base, balanceCents: 15000 })).toBe("active");
    expect(displayStatus({ ...base, balanceCents: 6000 })).toBe("partial");
    expect(displayStatus({ ...base, balanceCents: 0 })).toBe("empty");
    expect(displayStatus({ ...base, balanceCents: 15000, expiresAt: "2000-01-01T00:00:00Z" })).toBe("expired");
    expect(displayStatus({ ...base, balanceCents: 15000, status: "void" })).toBe("void");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-storage.test.ts`
Expected: FAIL with "Cannot find module '@/lib/gift-card-storage'".

- [ ] **Step 3: Write the implementation**

`lib/gift-card-storage.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gift-card-storage.ts tests/unit/gift-card-storage.test.ts
git commit -m "feat(gift-cards): storage — issue, lookup, display status"
```

---

### Task 5: Storage — validate, redeem, refund, void

**Files:**
- Modify: `lib/gift-card-storage.ts`
- Test: `tests/unit/gift-card-redeem.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-redeem.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  issueGiftCard,
  getGiftCardById,
  validateForRedemption,
  redeem,
  refund,
  voidGiftCard,
} from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-redeem-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function newCard(cents = 15000) {
  return issueGiftCard({ initialCents: cents, recipientEmail: "a@b.com" });
}

describe("validateForRedemption", () => {
  it("returns applicable = min(balance, want) for an active card", () => {
    const card = newCard(15000);
    const r = validateForRedemption(card.code, 9000);
    expect(r.ok).toBe(true);
    expect(r.applicableCents).toBe(9000);
  });
  it("caps applicable at the balance when the order exceeds it", () => {
    const card = newCard(15000);
    const r = validateForRedemption(card.code, 22000);
    expect(r.ok).toBe(true);
    expect(r.applicableCents).toBe(15000);
  });
  it("rejects an unknown / void / empty / expired card", () => {
    expect(validateForRedemption("DIVA-0000-0000", 100).ok).toBe(false);
    const v = newCard();
    voidGiftCard(v.id);
    expect(validateForRedemption(v.code, 100).reason).toBe("void");
  });
});

describe("redeem", () => {
  it("draws down the balance and writes a redeem ledger row", () => {
    const card = newCard(15000);
    redeem(card.id, "order-1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(6000);
    const ledger = getDb()
      .prepare("SELECT * FROM gift_card_redemptions WHERE gift_card_id = ?")
      .all(card.id) as { amount_cents: number; type: string; order_id: string }[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount_cents: 9000, type: "redeem", order_id: "order-1" });
  });

  it("supports multiple draw-downs until empty and refuses to overdraw", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    redeem(card.id, "o2", 6000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
    expect(() => redeem(card.id, "o3", 100)).toThrow();
  });

  it("is idempotent per order — a second redeem for the same order is a no-op", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    redeem(card.id, "o1", 9000); // webhook retry
    expect(getGiftCardById(card.id)!.balanceCents).toBe(6000);
  });
});

describe("refund", () => {
  it("credits the balance back and is idempotent per order", () => {
    const card = newCard(15000);
    redeem(card.id, "o1", 9000);
    refund(card.id, "o1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
    // second refund for the same order is a no-op
    refund(card.id, "o1", 9000);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
  it("never credits above the initial amount", () => {
    const card = newCard(15000);
    refund(card.id, "o1", 9999);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-redeem.test.ts`
Expected: FAIL ("redeem is not a function" / import errors).

- [ ] **Step 3: Add the implementation to `lib/gift-card-storage.ts`**

Append to `lib/gift-card-storage.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-redeem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gift-card-storage.ts tests/unit/gift-card-redeem.test.ts
git commit -m "feat(gift-cards): storage — validate, redeem, refund, void"
```

---

### Task 6: Storage — list + stats + history

**Files:**
- Modify: `lib/gift-card-storage.ts`
- Test: `tests/unit/gift-card-list.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-list.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  issueGiftCard,
  redeem,
  listGiftCards,
  getGiftCardWithHistory,
} from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-list-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("listGiftCards", () => {
  it("returns cards plus liability/issued/redeemed stats", () => {
    const a = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    issueGiftCard({ initialCents: 15000, recipientEmail: "c@d.com" });
    redeem(a.id, "o1", 9000); // a now has 6000 left

    const { cards, stats } = listGiftCards();
    expect(cards.length).toBe(2);
    expect(stats.issuedCents).toBe(30000);
    expect(stats.pendingCents).toBe(21000); // 6000 + 15000
    expect(stats.redeemedCents).toBe(9000);
    expect(stats.activeCount).toBe(2);
  });
});

describe("getGiftCardWithHistory", () => {
  it("returns the card with its redemption ledger newest-first", () => {
    const a = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    redeem(a.id, "o1", 5000);
    redeem(a.id, "o2", 4000);
    const res = getGiftCardWithHistory(a.id)!;
    expect(res.card.balanceCents).toBe(6000);
    expect(res.redemptions).toHaveLength(2);
    expect(res.redemptions[0].orderId).toBe("o2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-list.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Add the implementation to `lib/gift-card-storage.ts`**

Append:

```typescript
export type GiftCardStats = {
  activeCount: number;
  pendingCents: number;  // sum of balances on non-void cards = liability
  issuedCents: number;   // sum of initial amounts
  redeemedCents: number; // issued - pending (on non-void) ... computed from ledger for accuracy
};

export type GiftCardListItem = GiftCard & { display: GiftCardDisplayStatus };

export function listGiftCards(): { cards: GiftCardListItem[]; stats: GiftCardStats } {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM gift_cards ORDER BY created_at DESC")
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
      "SELECT * FROM gift_card_redemptions WHERE gift_card_id = ? ORDER BY created_at DESC",
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
```

> Note: `redeemedCents` is the net of `redeem` (+) and `refund` (−) ledger amounts, so refunds correctly reduce the "already redeemed" figure.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gift-card-storage.ts tests/unit/gift-card-list.test.ts
git commit -m "feat(gift-cards): storage — list, stats, history"
```

---

### Task 7: Issue-form schema (Zod)

**Files:**
- Create: `schemas/gift-card.ts`
- Test: `tests/unit/gift-card-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { issueGiftCardSchema } from "@/schemas/gift-card";

const valid = {
  amountCents: 15000,
  recipientEmail: "maria@example.com",
  recipientName: "María",
  fromLabel: "Maky · Diva Flowers",
  personalMessage: "¡Gracias!",
  reason: "loyalty" as const,
};

describe("issueGiftCardSchema", () => {
  it("accepts a valid $150 issuance", () => {
    expect(issueGiftCardSchema.safeParse(valid).success).toBe(true);
  });
  it("requires a valid recipient email", () => {
    expect(issueGiftCardSchema.safeParse({ ...valid, recipientEmail: "nope" }).success).toBe(false);
  });
  it("rejects amounts other than 15000 in phase 1", () => {
    expect(issueGiftCardSchema.safeParse({ ...valid, amountCents: 10000 }).success).toBe(false);
  });
  it("allows optional fields to be omitted", () => {
    expect(
      issueGiftCardSchema.safeParse({ amountCents: 15000, recipientEmail: "a@b.com" }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-schema.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

`schemas/gift-card.ts`:

```typescript
import { z } from "zod";

// Phase 1 ships a single denomination. Add more to this literal union to enable them.
export const GIFT_CARD_AMOUNTS = [15000] as const;

export const issueGiftCardSchema = z.object({
  amountCents: z
    .number()
    .int()
    .refine((n) => (GIFT_CARD_AMOUNTS as readonly number[]).includes(n), {
      message: "amount_not_allowed",
    }),
  recipientEmail: z.string().email("email_invalid"),
  recipientName: z.string().max(80).optional(),
  fromLabel: z.string().max(80).optional(),
  personalMessage: z.string().max(400).optional(),
  reason: z.enum(["loyalty", "apology", "prize", "marketing", "other"]).optional(),
});

export type IssueGiftCardInputDTO = z.infer<typeof issueGiftCardSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add schemas/gift-card.ts tests/unit/gift-card-schema.test.ts
git commit -m "feat(gift-cards): issue-form zod schema"
```

---

### Task 8: Gift card email (Resend)

**Files:**
- Create: `lib/gift-card-notifications.ts`
- Test: `tests/unit/gift-card-notifications.test.ts`

Mirror `lib/order-notifications.ts` (lazy `getResend()`, COLORS/FONT_STACKS, inline-HTML template). Use the **direction B** design from `.superpowers/brainstorm/15641-1782184528/content/email-design.html` (rouge gradient header, large amount, dark code block, redeem CTA). The recipient is the card's `recipientEmail`; the sender is `ORDER_NOTIFICATIONS_FROM`.

- [ ] **Step 1: Write the failing test**

`tests/unit/gift-card-notifications.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { GiftCard } from "@/types/gift-card";
import {
  __buildGiftCardHtml as buildHtml,
  __buildGiftCardBody as buildBody,
} from "@/lib/gift-card-notifications";

const card: GiftCard = {
  id: "gc_1",
  code: "DIVA-7K2M-9XQ4",
  initialCents: 15000,
  balanceCents: 15000,
  status: "active",
  recipientEmail: "maria@example.com",
  recipientName: "María",
  fromLabel: "Maky · Diva Flowers",
  personalMessage: "¡Gracias por ser parte de la familia Diva!",
  reason: "loyalty",
  issuedBy: "maky",
  expiresAt: "2027-06-22T00:00:00.000Z",
  createdAt: "2026-06-22T00:00:00.000Z",
  updatedAt: "2026-06-22T00:00:00.000Z",
};

describe("gift card email body", () => {
  it("includes the recipient, amount, code and expiry", () => {
    const body = buildBody(card, "es");
    expect(body).toContain("María");
    expect(body).toContain("$150.00");
    expect(body).toContain("DIVA-7K2M-9XQ4");
    expect(body).toContain("2027");
  });

  it("renders the personal message and the from label", () => {
    const body = buildBody(card, "es");
    expect(body).toContain("¡Gracias por ser parte de la familia Diva!");
    expect(body).toContain("Maky · Diva Flowers");
  });
});

describe("gift card email html", () => {
  it("escapes the personal message and embeds the code", () => {
    const html = buildHtml({ ...card, personalMessage: "<b>hi</b>" }, "es");
    expect(html).toContain("DIVA-7K2M-9XQ4");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).not.toContain("<b>hi</b>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-notifications.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

`lib/gift-card-notifications.ts`:

```typescript
import { Resend } from "resend";
import type { GiftCard } from "@/types/gift-card";

const COLORS = {
  ink: "#0E0D0C",
  bone: "#FAF6F0",
  rouge: "#B8345E",
  rougeDark: "#7d1f3d",
  rougeLight: "#d4677f",
};
const FONT_DISPLAY = `Georgia, "Times New Roman", serif`;
const FONT_BODY = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const FONT_MONO = `"SF Mono", Menlo, Consolas, monospace`;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://makythedivaflowers.com";

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExpiry(iso: string | undefined, locale: "en" | "es"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function __buildGiftCardBody(card: GiftCard, locale: "en" | "es"): string {
  const hi = card.recipientName
    ? locale === "es"
      ? `Hola ${card.recipientName},`
      : `Hi ${card.recipientName},`
    : locale === "es"
      ? "Hola,"
      : "Hi,";
  const lines = [
    hi,
    "",
    locale === "es"
      ? `Tienes una gift card de Diva Flowers por ${money(card.initialCents)}.`
      : `You have a Diva Flowers gift card for ${money(card.initialCents)}.`,
    "",
    card.personalMessage ? `"${card.personalMessage}"` : "",
    card.fromLabel ? `— ${card.fromLabel}` : "",
    "",
    locale === "es" ? `Tu código: ${card.code}` : `Your code: ${card.code}`,
    locale === "es"
      ? "Escríbelo en el checkout, en la web o en la tienda."
      : "Enter it at checkout, online or in store.",
    card.expiresAt
      ? locale === "es"
        ? `Válida hasta ${formatExpiry(card.expiresAt, locale)}.`
        : `Valid until ${formatExpiry(card.expiresAt, locale)}.`
      : "",
    "",
    `${BASE_URL}/${locale}`,
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export function __buildGiftCardHtml(card: GiftCard, locale: "en" | "es"): string {
  const name = card.recipientName ? escapeHtml(card.recipientName) : "";
  const greeting =
    locale === "es"
      ? name
        ? `${name}, alguien pensó en ti`
        : "Alguien pensó en ti"
      : name
        ? `${name}, someone thought of you`
        : "Someone thought of you";
  const sub =
    locale === "es" ? "Tienes una gift card" : "You have a gift card";
  const codeLabel = locale === "es" ? "Tu código" : "Your code";
  const cta = locale === "es" ? "Canjear mi tarjeta →" : "Redeem my card →";
  const howto =
    locale === "es"
      ? "Escribe el código en el checkout, en la web o en la tienda."
      : "Enter the code at checkout, online or in store.";
  const validUntil = card.expiresAt
    ? (locale === "es" ? "Válida hasta " : "Valid until ") + formatExpiry(card.expiresAt, locale)
    : "";
  const message = card.personalMessage
    ? `<p style="font-style:italic;font-size:15px;color:${COLORS.ink};opacity:.82;margin:0 4px 16px;">"${escapeHtml(card.personalMessage)}"${card.fromLabel ? `<br><span style="opacity:.6;font-size:12px;">— ${escapeHtml(card.fromLabel)}</span>` : ""}</p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${COLORS.bone};font-family:${FONT_BODY};">
  <div style="max-width:420px;margin:0 auto;background:${COLORS.bone};border-radius:13px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,${COLORS.rougeDark} 0%,${COLORS.rouge} 60%,${COLORS.rougeLight} 100%);padding:30px 28px 26px;text-align:center;color:${COLORS.bone};font-family:${FONT_DISPLAY};">
      <div style="font-size:12px;letter-spacing:0.32em;text-transform:uppercase;opacity:.9;">maky · diva flowers</div>
      <div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;margin-top:18px;opacity:.85;">${escapeHtml(greeting)}</div>
      <div style="font-size:27px;line-height:1.15;margin:6px 0;">${sub}</div>
      <div style="font-size:52px;margin:6px 0 2px;">${money(card.initialCents)}</div>
      <div style="font-size:20px;margin-top:4px;">🌸</div>
    </div>
    <div style="padding:22px 28px 26px;text-align:center;">
      ${message}
      <div style="background:${COLORS.ink};border-radius:10px;padding:14px;">
        <div style="font-family:${FONT_BODY};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.rougeLight};">${codeLabel}</div>
        <div style="font-family:${FONT_MONO};font-size:21px;font-weight:700;letter-spacing:0.1em;color:${COLORS.bone};margin-top:5px;">${card.code}</div>
      </div>
      <a href="${BASE_URL}/${locale}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.bone};padding:13px 26px;border-radius:8px;font-family:${FONT_BODY};font-size:13px;font-weight:700;margin-top:16px;text-decoration:none;">${cta}</a>
      <div style="font-family:${FONT_BODY};font-size:11px;opacity:.55;margin-top:16px;line-height:1.5;">${howto}<br>${validUntil}</div>
    </div>
  </div>
</body></html>`;
}

export async function notifyGiftCardIssued(
  card: GiftCard,
  locale: "en" | "es" = "es",
): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  const from = process.env.ORDER_NOTIFICATIONS_FROM;
  if (!resend || !from) {
    console.warn(
      "[gift-card-notifications] missing config (RESEND_API_KEY / ORDER_NOTIFICATIONS_FROM); skipping email",
    );
    return { sent: false, error: "email_not_configured" };
  }
  const subject =
    locale === "es"
      ? `Tienes una gift card de Diva Flowers 💐`
      : `You have a Diva Flowers gift card 💐`;
  try {
    const result = await resend.emails.send({
      from,
      to: card.recipientEmail,
      subject,
      text: __buildGiftCardBody(card, locale),
      html: __buildGiftCardHtml(card, locale),
    });
    if (result.error) {
      console.error("[gift-card-notifications] resend error", result.error);
      return { sent: false, error: "send_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[gift-card-notifications] send threw", e);
    return { sent: false, error: "send_failed" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/gift-card-notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gift-card-notifications.ts tests/unit/gift-card-notifications.test.ts
git commit -m "feat(gift-cards): recipient email (Resend, hero design)"
```

---

### Task 9: Admin API — issue + list

**Files:**
- Create: `app/api/admin/gift-cards/route.ts`
- Test: `tests/unit/api-gift-cards.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/api-gift-cards.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

// notifyGiftCardIssued hits Resend; stub it so the route is testable offline.
vi.mock("@/lib/gift-card-notifications", () => ({
  notifyGiftCardIssued: vi.fn(async () => ({ sent: true })),
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-api-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function importRoute() {
  return await import("@/app/api/admin/gift-cards/route");
}

describe("POST /api/admin/gift-cards", () => {
  it("issues a card, emails it, and returns the code", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://t/api/admin/gift-cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 15000, recipientEmail: "maria@example.com", recipientName: "María" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.card.code).toMatch(/^DIVA-/);
    expect(data.emailSent).toBe(true);

    const { notifyGiftCardIssued } = await import("@/lib/gift-card-notifications");
    expect(notifyGiftCardIssued).toHaveBeenCalledOnce();
  });

  it("rejects a bad payload with 400", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://t/api/admin/gift-cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 999, recipientEmail: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/gift-cards", () => {
  it("lists cards with stats", async () => {
    const { POST, GET } = await importRoute();
    await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: 15000, recipientEmail: "a@b.com" }),
      }),
    );
    const res = await GET();
    const data = await res.json();
    expect(data.cards.length).toBe(1);
    expect(data.stats.issuedCents).toBe(15000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-gift-cards.test.ts`
Expected: FAIL (route missing).

- [ ] **Step 3: Write the implementation**

`app/api/admin/gift-cards/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { issueGiftCardSchema } from "@/schemas/gift-card";
import { issueGiftCard, listGiftCards } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";

export const runtime = "nodejs";

export async function GET() {
  const { cards, stats } = listGiftCards();
  return NextResponse.json({ cards, stats });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = issueGiftCardSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const card = issueGiftCard({
    initialCents: input.amountCents,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    fromLabel: input.fromLabel,
    personalMessage: input.personalMessage,
    reason: input.reason,
    issuedBy: "maky", // matches the hardcoded operator used by intake (takenBy)
  });

  // Email failure must NOT roll back issuance — the card exists and staff can resend.
  const mail = await notifyGiftCardIssued(card, "es");
  return NextResponse.json({ card, emailSent: mail.sent, emailError: mail.error });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-gift-cards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/gift-cards/route.ts tests/unit/api-gift-cards.test.ts
git commit -m "feat(gift-cards): admin API — issue + list"
```

---

### Task 10: Admin API — detail, void, resend

**Files:**
- Create: `app/api/admin/gift-cards/[id]/route.ts`
- Create: `app/api/admin/gift-cards/[id]/void/route.ts`
- Create: `app/api/admin/gift-cards/[id]/resend/route.ts`
- Test: `tests/unit/api-gift-cards-detail.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/api-gift-cards-detail.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";

vi.mock("@/lib/gift-card-notifications", () => ({
  notifyGiftCardIssued: vi.fn(async () => ({ sent: true })),
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-detail-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("gift card detail / void / resend", () => {
  it("GET returns the card + history", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { GET } = await import("@/app/api/admin/gift-cards/[id]/route");
    const res = await GET(new Request("http://t"), ctx(card.id));
    const data = await res.json();
    expect(data.card.id).toBe(card.id);
    expect(Array.isArray(data.redemptions)).toBe(true);
  });

  it("void marks the card void", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/gift-cards/[id]/void/route");
    const res = await POST(new Request("http://t", { method: "POST" }), ctx(card.id));
    expect(res.status).toBe(200);
    expect(getGiftCardById(card.id)!.status).toBe("void");
  });

  it("resend re-sends the email", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/gift-cards/[id]/resend/route");
    const res = await POST(new Request("http://t", { method: "POST" }), ctx(card.id));
    expect(res.status).toBe(200);
    const { notifyGiftCardIssued } = await import("@/lib/gift-card-notifications");
    expect(notifyGiftCardIssued).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-gift-cards-detail.test.ts`
Expected: FAIL (routes missing).

- [ ] **Step 3: Write the implementations**

`app/api/admin/gift-cards/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getGiftCardWithHistory } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = getGiftCardWithHistory(id);
  if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res);
}
```

`app/api/admin/gift-cards/[id]/void/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getGiftCardById, voidGiftCard } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getGiftCardById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  voidGiftCard(id);
  return NextResponse.json({ ok: true });
}
```

`app/api/admin/gift-cards/[id]/resend/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getGiftCardById } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const card = getGiftCardById(id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const mail = await notifyGiftCardIssued(card, "es");
  return NextResponse.json({ ok: mail.sent, error: mail.error });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-gift-cards-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/gift-cards
git add tests/unit/api-gift-cards-detail.test.ts
git commit -m "feat(gift-cards): admin API — detail, void, resend"
```

---

### Task 11: i18n keys for the admin UI

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

Add an `admin_gift_cards` namespace used by Task 12. (Client components read these via `useTranslations("admin_gift_cards")`.)

- [ ] **Step 1: Add the namespace to `messages/es.json`**

Insert a top-level key `"admin_gift_cards"` (alphabetical placement is not required; match the file's existing style):

```json
"admin_gift_cards": {
  "title": "Gift Cards",
  "issue_cta": "Emitir gift card",
  "stat_active": "Activas",
  "stat_pending": "Saldo pendiente",
  "stat_issued": "Emitido total",
  "stat_redeemed": "Ya canjeado",
  "col_code": "Código",
  "col_recipient": "Destinatario",
  "col_balance": "Saldo",
  "col_status": "Estado",
  "col_expires": "Vence",
  "col_reason": "Motivo",
  "status_active": "Activa",
  "status_partial": "Usada parcial",
  "status_empty": "Agotada",
  "status_expired": "Vencida",
  "status_void": "Anulada",
  "form_amount": "Monto",
  "form_recipient_email": "Email del destinatario",
  "form_recipient_name": "Nombre del destinatario",
  "form_from": "De parte de",
  "form_message": "Mensaje personal",
  "form_reason": "Motivo (interno)",
  "form_optional": "opcional",
  "form_submit": "Emitir y enviar por email",
  "form_submitting": "Emitiendo…",
  "reason_loyalty": "Lealtad",
  "reason_apology": "Disculpa",
  "reason_prize": "Premio/sorteo",
  "reason_marketing": "Marketing",
  "reason_other": "Otro",
  "issued_ok": "Gift card emitida y enviada",
  "issued_no_email": "Gift card emitida (el email falló — usa Reenviar)",
  "detail_history": "Historial de canjes",
  "detail_resend": "Reenviar email",
  "detail_copy": "Copiar código",
  "detail_void": "Anular",
  "detail_voided": "Anulada",
  "empty": "Aún no has emitido gift cards"
}
```

- [ ] **Step 2: Add the same namespace to `messages/en.json`** (English copy)

```json
"admin_gift_cards": {
  "title": "Gift Cards",
  "issue_cta": "Issue gift card",
  "stat_active": "Active",
  "stat_pending": "Outstanding balance",
  "stat_issued": "Total issued",
  "stat_redeemed": "Redeemed",
  "col_code": "Code",
  "col_recipient": "Recipient",
  "col_balance": "Balance",
  "col_status": "Status",
  "col_expires": "Expires",
  "col_reason": "Reason",
  "status_active": "Active",
  "status_partial": "Partly used",
  "status_empty": "Empty",
  "status_expired": "Expired",
  "status_void": "Voided",
  "form_amount": "Amount",
  "form_recipient_email": "Recipient email",
  "form_recipient_name": "Recipient name",
  "form_from": "From",
  "form_message": "Personal message",
  "form_reason": "Reason (internal)",
  "form_optional": "optional",
  "form_submit": "Issue and email",
  "form_submitting": "Issuing…",
  "reason_loyalty": "Loyalty",
  "reason_apology": "Apology",
  "reason_prize": "Prize",
  "reason_marketing": "Marketing",
  "reason_other": "Other",
  "issued_ok": "Gift card issued and sent",
  "issued_no_email": "Gift card issued (email failed — use Resend)",
  "detail_history": "Redemption history",
  "detail_resend": "Resend email",
  "detail_copy": "Copy code",
  "detail_void": "Void",
  "detail_voided": "Voided",
  "empty": "No gift cards issued yet"
}
```

- [ ] **Step 3: Verify JSON parses**

Run: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(gift-cards): i18n keys for admin gift cards"
```

---

### Task 12: Admin UI — list, issue form, detail, nav

**Files:**
- Create: `app/[locale]/admin/gift-cards/page.tsx`
- Create: `components/admin/gift-cards/GiftCardsView.tsx`
- Create: `components/admin/gift-cards/IssueGiftCardForm.tsx`
- Create: `components/admin/gift-cards/GiftCardDetail.tsx`
- Modify: `components/admin/dashboard/DashboardShell.tsx` (add nav link)
- Test: `tests/unit/GiftCardsView.test.tsx`

Styling follows `gestion.html`, `emitir-form.html`, and the detail described in the spec (all in `.superpowers/brainstorm/15641-1782184528/content/`). Use existing Tailwind tokens (`bg-bone`, `text-ink`, `text-rouge`, `bg-rouge`, `border-ink/10`) as in `ProductPricesPage.tsx`.

- [ ] **Step 1: Write the failing component test**

`tests/unit/GiftCardsView.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import GiftCardsView from "@/components/admin/gift-cards/GiftCardsView";
import type { GiftCardListItem, GiftCardStats } from "@/lib/gift-card-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const cards: GiftCardListItem[] = [
  {
    id: "gc_1", code: "DIVA-7K2M-9XQ4", initialCents: 15000, balanceCents: 6000,
    status: "active", recipientEmail: "jose@example.com", recipientName: "José",
    reason: "apology", expiresAt: "2027-05-10T00:00:00Z",
    createdAt: "2026-05-10T00:00:00Z", updatedAt: "2026-05-10T00:00:00Z",
    display: "partial",
  },
];
const stats: GiftCardStats = { activeCount: 1, pendingCents: 6000, issuedCents: 15000, redeemedCents: 9000 };

describe("GiftCardsView", () => {
  it("renders the stats and a row with its code, balance and status", () => {
    wrap(<GiftCardsView initialCards={cards} initialStats={stats} locale="es" />);
    expect(screen.getByText("DIVA-7K2M-9XQ4")).toBeDefined();
    expect(screen.getByText("José")).toBeDefined();
    expect(screen.getByText(/\$60\.00/)).toBeDefined(); // balance 6000
    expect(screen.getByText("Usada parcial")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/GiftCardsView.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Write `IssueGiftCardForm.tsx`**

`components/admin/gift-cards/IssueGiftCardForm.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function IssueGiftCardForm({ onIssued }: { onIssued: () => void }) {
  const t = useTranslations("admin_gift_cards");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: 15000,
        recipientEmail: email,
        recipientName: name || undefined,
        fromLabel: from || undefined,
        personalMessage: message || undefined,
        reason: reason || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("form_recipient_email"));
      return;
    }
    onIssued();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold">{t("form_amount")}</label>
        <span className="inline-block rounded-lg bg-rouge px-4 py-2 font-bold text-bone">$150</span>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_recipient_email")}</span>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink/20 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_recipient_name")} <em className="opacity-50">({t("form_optional")})</em></span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_from")} <em className="opacity-50">({t("form_optional")})</em></span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_message")} <em className="opacity-50">({t("form_optional")})</em></span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[60px] w-full rounded-lg border border-ink/20 px-3 py-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("form_reason")} <em className="opacity-50">({t("form_optional")})</em></span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-ink/20 px-3 py-2">
          <option value="">—</option>
          <option value="loyalty">{t("reason_loyalty")}</option>
          <option value="apology">{t("reason_apology")}</option>
          <option value="prize">{t("reason_prize")}</option>
          <option value="marketing">{t("reason_marketing")}</option>
          <option value="other">{t("reason_other")}</option>
        </select>
      </label>
      {error && <p className="text-sm text-rouge">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-rouge py-3 font-bold text-bone disabled:opacity-50">
        {busy ? t("form_submitting") : t("form_submit")}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write `GiftCardDetail.tsx`**

`components/admin/gift-cards/GiftCardDetail.tsx`:

```typescript
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { GiftCard, GiftCardRedemption } from "@/types/gift-card";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function GiftCardDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const t = useTranslations("admin_gift_cards");
  const [card, setCard] = useState<GiftCard | null>(null);
  const [history, setHistory] = useState<GiftCardRedemption[]>([]);

  useEffect(() => {
    fetch(`/api/admin/gift-cards/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCard(d.card);
        setHistory(d.redemptions ?? []);
      });
  }, [id]);

  if (!card) return null;

  async function voidCard() {
    await fetch(`/api/admin/gift-cards/${id}/void`, { method: "POST" });
    onChanged();
  }
  async function resend() {
    await fetch(`/api/admin/gift-cards/${id}/resend`, { method: "POST" });
  }
  function copy() {
    void navigator.clipboard?.writeText(card!.code);
  }

  return (
    <div className="space-y-4">
      <div className="font-mono text-lg font-bold text-rouge">{card.code}</div>
      <div className="text-sm">
        {card.recipientName ? `${card.recipientName} · ` : ""}
        {card.recipientEmail}
      </div>
      <div className="text-sm">{money(card.balanceCents)} / {money(card.initialCents)}</div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase opacity-60">{t("detail_history")}</h4>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span>{h.type === "refund" ? "↩︎" : "→"} {h.orderId ?? "—"}</span>
              <span>{money(Math.abs(h.amountCents))}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <button onClick={resend} className="rounded-lg border border-ink/20 px-3 py-2 text-sm">{t("detail_resend")}</button>
        <button onClick={copy} className="rounded-lg border border-ink/20 px-3 py-2 text-sm">{t("detail_copy")}</button>
        {card.status !== "void" && (
          <button onClick={voidCard} className="rounded-lg border border-rouge px-3 py-2 text-sm text-rouge">{t("detail_void")}</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `GiftCardsView.tsx`**

`components/admin/gift-cards/GiftCardsView.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { GiftCardListItem, GiftCardStats } from "@/lib/gift-card-storage";
import IssueGiftCardForm from "./IssueGiftCardForm";
import GiftCardDetail from "./GiftCardDetail";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_KEY: Record<string, string> = {
  active: "status_active",
  partial: "status_partial",
  empty: "status_empty",
  expired: "status_expired",
  void: "status_void",
};

export default function GiftCardsView({
  initialCards,
  initialStats,
  locale,
}: {
  initialCards: GiftCardListItem[];
  initialStats: GiftCardStats;
  locale: "en" | "es";
}) {
  const t = useTranslations("admin_gift_cards");
  const [cards, setCards] = useState(initialCards);
  const [stats, setStats] = useState(initialStats);
  const [issuing, setIssuing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    const d = await fetch("/api/admin/gift-cards").then((r) => r.json());
    setCards(d.cards);
    setStats(d.stats);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <button onClick={() => setIssuing(true)} className="rounded-lg bg-rouge px-4 py-2 font-bold text-bone">
          + {t("issue_cta")}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("stat_active")} value={String(stats.activeCount)} />
        <Stat label={t("stat_pending")} value={money(stats.pendingCents)} rouge />
        <Stat label={t("stat_issued")} value={money(stats.issuedCents)} />
        <Stat label={t("stat_redeemed")} value={money(stats.redeemedCents)} />
      </div>

      {cards.length === 0 ? (
        <p className="opacity-60">{t("empty")}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase opacity-60">
              <th className="p-2">{t("col_code")}</th>
              <th className="p-2">{t("col_recipient")}</th>
              <th className="p-2">{t("col_balance")}</th>
              <th className="p-2">{t("col_status")}</th>
              <th className="p-2">{t("col_expires")}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t border-ink/10 hover:bg-ink/5" onClick={() => setOpenId(c.id)}>
                <td className="p-2 font-mono font-semibold">{c.code}</td>
                <td className="p-2">{c.recipientName ? `${c.recipientName} · ` : ""}{c.recipientEmail}</td>
                <td className="p-2">{money(c.balanceCents)} / {money(c.initialCents)}</td>
                <td className="p-2">{t(STATUS_KEY[c.display])}</td>
                <td className="p-2">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {issuing && (
        <Drawer onClose={() => setIssuing(false)}>
          <IssueGiftCardForm
            onIssued={() => {
              setIssuing(false);
              void refresh();
            }}
          />
        </Drawer>
      )}
      {openId && (
        <Drawer onClose={() => setOpenId(null)}>
          <GiftCardDetail
            id={openId}
            onChanged={() => {
              setOpenId(null);
              void refresh();
            }}
          />
        </Drawer>
      )}
    </div>
  );
}

function Stat({ label, value, rouge }: { label: string; value: string; rouge?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-bone p-3">
      <div className={`text-2xl font-bold ${rouge ? "text-rouge" : "text-ink"}`}>{value}</div>
      <div className="text-xs uppercase opacity-60">{label}</div>
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-auto bg-bone p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the server page**

`app/[locale]/admin/gift-cards/page.tsx`:

```typescript
import { listGiftCards } from "@/lib/gift-card-storage";
import GiftCardsView from "@/components/admin/gift-cards/GiftCardsView";

export default async function AdminGiftCardsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  const { cards, stats } = listGiftCards();
  return <GiftCardsView initialCards={cards} initialStats={stats} locale={locale} />;
}
```

- [ ] **Step 7: Add the nav link in `DashboardShell.tsx`**

In `components/admin/dashboard/DashboardShell.tsx`, inside the `<nav>` block (next to the "Libro de órdenes" link), add:

```tsx
<Link
  href={`/${locale}/admin/gift-cards`}
  className="flex min-h-11 items-center rounded-lg px-3 hover:bg-ink/5"
>
  Gift Cards
</Link>
```

- [ ] **Step 8: Run the component test + type check**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/GiftCardsView.test.tsx`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/[locale]/admin/gift-cards components/admin/gift-cards components/admin/dashboard/DashboardShell.tsx tests/unit/GiftCardsView.test.tsx
git commit -m "feat(gift-cards): admin UI — list, issue form, detail, nav"
```

**Milestone A is now shippable.** Manually verify: log into `/es/admin/gift-cards`, issue a $150 card to a real inbox, confirm the email arrives with the code, then void/resend from the detail drawer.

---

## Milestone B — Redemption at checkout (web + intake)

After Milestone B a customer can enter a code at web checkout and on the intake form; the gift card reduces the amount charged, $0 totals skip Stripe, and canceling restores balance.

---

### Task 13: Order gift-card fields (type + row mapping + upsert)

**Files:**
- Modify: `types/order.ts`
- Modify: `lib/order-row.ts`
- Modify: `lib/order-storage.ts`
- Test: `tests/unit/order-gift-card-fields.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/order-gift-card-fields.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-ord-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const baseOrder: Order = {
  id: "do_gc",
  source: "web",
  locale: "es",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "pickup",
    recipient: { name: "María", phone: "5165550100" },
    window: { date: "2026-07-01", slot: "midday" },
  },
  contact: { phone: "5165550100", email: "a@b.com" },
  totals: { subtotalCents: 19000, deliveryCents: 0, taxCents: 1639, totalCents: 20639 },
  status: "pending",
  paymentStatus: "paid",
  paymentMethod: "gift-card",
  giftCardId: "gc_1",
  giftCardCents: 15000,
  createdAt: "2026-06-22T00:00:00Z",
  updatedAt: "2026-06-22T00:00:00Z",
};

describe("order gift card fields", () => {
  it("round-trips giftCardId and giftCardCents through saveOrder/getOrder", async () => {
    await saveOrder(baseOrder);
    const read = await getOrder("do_gc");
    expect(read?.giftCardId).toBe("gc_1");
    expect(read?.giftCardCents).toBe(15000);
    expect(read?.paymentMethod).toBe("gift-card");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/order-gift-card-fields.test.ts`
Expected: FAIL — `giftCardId`/`giftCardCents` not on `Order`, and `"gift-card"` not in `PaymentMethod`.

- [ ] **Step 3: Extend `types/order.ts`**

Change the `PaymentMethod` union (add `"gift-card"`):

```typescript
export type PaymentMethod = "cash" | "zelle" | "card-terminal" | "ach" | "stripe" | "gift-card";
```

Add two fields to the `Order` type (after `stripeCheckoutSessionId?: string;`):

```typescript
  giftCardId?: string;
  giftCardCents?: number; // amount the gift card covered on this order
```

- [ ] **Step 4: Extend `lib/order-row.ts`**

Add to the `OrderRow` type:

```typescript
  gift_card_id: string | null;
  gift_card_cents: number | null;
```

Add to the object returned by `orderToRow(o)`:

```typescript
    gift_card_id: o.giftCardId ?? null,
    gift_card_cents: o.giftCardCents ?? null,
```

Add to the object returned by `rowToOrder(r)` (only set when present, to keep optional semantics):

```typescript
    ...(r.gift_card_id != null ? { giftCardId: r.gift_card_id } : {}),
    ...(r.gift_card_cents != null ? { giftCardCents: r.gift_card_cents } : {}),
```

- [ ] **Step 5: Extend the upsert SQL in `lib/order-storage.ts`**

In `upsertSqlite`, add the two columns to (a) the INSERT column list, (b) the VALUES placeholders, and (c) the `ON CONFLICT ... DO UPDATE SET` clause:

- Column list: add `gift_card_id, gift_card_cents` (e.g. after `stripe_checkout_session_id`).
- VALUES: add `@gift_card_id, @gift_card_cents`.
- ON CONFLICT update: add
  ```
  gift_card_id=excluded.gift_card_id,
  gift_card_cents=excluded.gift_card_cents,
  ```

- [ ] **Step 6: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/order-gift-card-fields.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add types/order.ts lib/order-row.ts lib/order-storage.ts tests/unit/order-gift-card-fields.test.ts
git commit -m "feat(gift-cards): persist gift card id + amount on orders"
```

---

### Task 14: Checkout preview-validation API

**Files:**
- Create: `app/api/checkout/gift-card/route.ts`
- Test: `tests/unit/api-checkout-gift-card.test.ts`

This endpoint lets the checkout UI show the applied amount before paying. It returns only the safe `GiftCardPublic` shape; the authoritative application happens in the intent route (Task 15).

- [ ] **Step 1: Write the failing test**

`tests/unit/api-checkout-gift-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, voidGiftCard } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-co-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function post(code: string) {
  const { POST } = await import("@/app/api/checkout/gift-card/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
}

describe("POST /api/checkout/gift-card", () => {
  it("returns balance for a valid code", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const res = await post(card.code.toLowerCase());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.balanceCents).toBe(15000);
  });
  it("returns valid:false for a void/unknown code", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    voidGiftCard(card.id);
    const data = await (await post(card.code)).json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("void");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-checkout-gift-card.test.ts`
Expected: FAIL (route missing).

- [ ] **Step 3: Write the implementation**

`app/api/checkout/gift-card/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateForRedemption } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().min(1).max(50) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ valid: false, reason: "invalid" }, { status: 400 });

  // wantCents is large so applicableCents reflects the full balance for the preview.
  const check = validateForRedemption(parsed.data.code, Number.MAX_SAFE_INTEGER);
  if (!check.ok) return NextResponse.json({ valid: false, reason: check.reason });

  return NextResponse.json({
    valid: true,
    code: check.card.code,
    balanceCents: check.card.balanceCents,
    expiresAt: check.card.expiresAt,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/api-checkout-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/gift-card/route.ts tests/unit/api-checkout-gift-card.test.ts
git commit -m "feat(gift-cards): checkout preview-validation endpoint"
```

---

### Task 15: Intent route — apply code (partial + $0 full coverage)

**Files:**
- Modify: `app/api/checkout/intent/route.ts`
- Test: `tests/unit/checkout-intent-gift-card.test.ts`

The route validates the code server-side, computes `applied = min(balance, total)`, stores `giftCardId`/`giftCardCents` on the order, and:
- **partial** (`total - applied > 0`): create the Stripe PaymentIntent for `total - applied` (debit happens in the webhook, Task 16);
- **full coverage** (`total - applied === 0`): skip Stripe, `redeem()` now, mark paid by gift card, enqueue print + notify, return `{ paid: true, orderId }`.

- [ ] **Step 1: Write the failing test**

`tests/unit/checkout-intent-gift-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { getOrder } from "@/lib/order-storage";

// Stripe + side effects stubbed so the route runs offline.
const piCreate = vi.fn(async () => ({ id: "pi_1", client_secret: "cs_1" }));
vi.mock("@/lib/stripe-server", () => ({ stripe: { paymentIntents: { create: piCreate } } }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intent-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function body(code: string) {
  return {
    locale: "es",
    lines: [{ productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    giftCardCode: code,
    form: {
      contact: { email: "a@b.com", phone: "5165550100" },
      delivery: {
        method: "pickup",
        recipient: { name: "María", phone: "5165550100" },
        window: { date: "2026-07-01", slot: "midday" },
        cardMessage: "",
      },
    },
  };
}

async function callIntent(b: unknown) {
  const { POST } = await import("@/app/api/checkout/intent/route");
  return POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
}

describe("intent route with gift card", () => {
  it("full coverage: no Stripe, marks paid by gift card, returns paid:true, debits balance", async () => {
    const card = issueGiftCard({ initialCents: 100000, recipientEmail: "a@b.com" }); // huge → covers any order
    const res = await callIntent(body(card.code));
    const data = await res.json();
    expect(data.paid).toBe(true);
    expect(piCreate).not.toHaveBeenCalled();
    const order = await getOrder(data.orderId);
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.paymentMethod).toBe("gift-card");
    expect(getGiftCardById(card.id)!.balanceCents).toBeLessThan(100000);
  });

  it("partial: Stripe PI created for total minus a small balance; balance not yet debited", async () => {
    const card = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" }); // $5 toward the order
    const res = await callIntent(body(card.code));
    const data = await res.json();
    expect(data.clientSecret).toBe("cs_1");
    expect(piCreate).toHaveBeenCalledOnce();
    const amount = (piCreate.mock.calls[0][0] as { amount: number }).amount;
    expect(amount).toBeGreaterThan(0);
    // balance debited only on webhook success
    expect(getGiftCardById(card.id)!.balanceCents).toBe(500);
    const order = await getOrder(data.orderId);
    expect(order?.giftCardId).toBe(card.id);
    expect(order?.giftCardCents).toBe(500);
  });

  it("rejects an invalid code with 400", async () => {
    const res = await callIntent(body("DIVA-0000-0000"));
    expect(res.status).toBe(400);
  });
});
```

> Verified: `enqueuePrintJob` is `@/lib/print-queue`, `notifyOrderPaid` is `@/lib/order-notifications`, `stripe` is `@/lib/stripe-server`. The full-coverage path does not send GA4 (see note in Step 3), so no analytics import/mock is needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/checkout-intent-gift-card.test.ts`
Expected: FAIL (route ignores `giftCardCode`).

- [ ] **Step 3: Modify `app/api/checkout/intent/route.ts`**

Add to the imports:

```typescript
import { validateForRedemption, redeem } from "@/lib/gift-card-storage";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { enqueuePrintJob } from "@/lib/print-queue";
```

(GA4 purchase analytics is intentionally skipped on the $0 full-coverage path — it's a $0 charge and the helper used by the webhook is internal to that route. Keep the side effects to the shop email + print job.)

Add `giftCardCode` to `requestSchema`:

```typescript
const requestSchema = z.object({
  locale: z.enum(["en", "es"]),
  lines: z.array(cartLineSchema).min(1, "cart_empty"),
  form: checkoutSchema,
  giftCardCode: z.string().min(1).max(50).optional(),
});
```

After `const totals = computeOrderTotals(subtotal, deliveryCents);` and after `order` is constructed (it currently sets `status`/`paymentStatus` to `"pending"`), insert the gift-card branch. Replace the existing `saveOrder` + PaymentIntent section with:

```typescript
  // --- Gift card (optional) ---
  let giftCardId: string | undefined;
  let giftCardCents = 0;
  if (parsed.data.giftCardCode) {
    const check = validateForRedemption(parsed.data.giftCardCode, totals.totalCents);
    if (!check.ok) {
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    giftCardId = check.card.id;
    giftCardCents = check.applicableCents;
  }
  const amountToCharge = totals.totalCents - giftCardCents;

  order.giftCardId = giftCardId;
  order.giftCardCents = giftCardCents || undefined;

  // Full coverage: no Stripe charge. Redeem now, mark paid by gift card, fire side effects.
  if (giftCardId && amountToCharge <= 0) {
    order.paymentStatus = "paid";
    order.paymentMethod = "gift-card";
    order.paidAt = now;
    try {
      await saveOrder(order);
      redeem(giftCardId, order.id, giftCardCents);
    } catch (e) {
      console.error("[intent] gift card full-coverage failed", e);
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    await notifyOrderPaid(order);
    try {
      await enqueuePrintJob(order);
    } catch (e) {
      console.error("[print] enqueue failed for order", order.id, e);
    }
    return NextResponse.json({ paid: true, orderId }, { status: 200 });
  }

  // Partial or no gift card: charge the remainder via Stripe (debit happens in the webhook).
  try {
    await saveOrder(order);
  } catch (e) {
    console.error("[stripe] saveOrder failed", e);
    return NextResponse.json({ errors: { formErrors: ["unknown_error"] } }, { status: 500 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountToCharge,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId,
          locale,
          fulfillmentMethod: fulfillment.method,
          ...(giftCardId ? { giftCardId, giftCardCents: String(giftCardCents) } : {}),
        },
        receipt_email: form.contact.email,
      },
      { idempotencyKey: orderId },
    );
    if (!paymentIntent.client_secret) {
      console.error("[stripe] paymentIntent.client_secret is null", paymentIntent.id);
      return NextResponse.json({ errors: { formErrors: ["payment_init_failed"] } }, { status: 502 });
    }
    await updateOrderPaymentIntent(orderId, paymentIntent.id);
    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId }, { status: 200 });
  } catch (e) {
    console.error("[stripe] paymentIntents.create failed", e);
    return NextResponse.json({ errors: { formErrors: ["payment_init_failed"] } }, { status: 502 });
  }
```

> The pre-existing `saveOrder` + `paymentIntents.create` block is replaced by the above (do not leave the old copy below it).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/checkout-intent-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/intent/route.ts tests/unit/checkout-intent-gift-card.test.ts
git commit -m "feat(gift-cards): apply code in checkout intent (partial + \$0 coverage)"
```

---

### Task 16: Webhook — commit redemption on payment success

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Test: `tests/unit/webhook-gift-card.test.ts`

When a partial-coverage order's PaymentIntent succeeds, debit the gift card once (guarded by the existing `!wasAlreadyPaid` idempotency).

- [ ] **Step 1: Write the failing test**

`tests/unit/webhook-gift-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { saveOrder, updateOrderPaymentIntent } from "@/lib/order-storage";
import type { Order } from "@/types/order";

vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics-server", () => ({ sendPurchaseToGA4: vi.fn(async () => {}) }));
// The webhook verifies via `stripe.webhooks.constructEvent(body, signature, secret)` (synchronous).
// Stub it to parse the body straight back into the event object.
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    webhooks: { constructEvent: (raw: string) => JSON.parse(raw) },
  },
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-wh-gc-" + process.pid + ".json");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function seedPartialOrder(cardId: string) {
  const order: Order = {
    id: "do_wh", source: "web", locale: "es",
    // real product id so the webhook's internal GA4 payload builder resolves the line
    lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "M", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    contact: { phone: "5165550100", email: "a@b.com" },
    totals: { subtotalCents: 20000, deliveryCents: 0, taxCents: 1725, totalCents: 21725 },
    status: "pending", paymentStatus: "pending",
    giftCardId: cardId, giftCardCents: 500,
    createdAt: "2026-06-22T00:00:00Z", updatedAt: "2026-06-22T00:00:00Z",
  };
  await saveOrder(order);
  await updateOrderPaymentIntent("do_wh", "pi_wh");
}

describe("webhook commits gift card redemption", () => {
  it("debits the gift card once on payment_intent.succeeded", async () => {
    const card = issueGiftCard({ initialCents: 500, recipientEmail: "a@b.com" });
    await seedPartialOrder(card.id);
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const evt = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_wh" } } });
    const req = new Request("http://t", { method: "POST", headers: { "stripe-signature": "sig" }, body: evt });
    await POST(req);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
    // replaying the same event must not double-debit
    await POST(new Request("http://t", { method: "POST", headers: { "stripe-signature": "sig" }, body: evt }));
    expect(getGiftCardById(card.id)!.balanceCents).toBe(0);
  });
});
```

> Verified: the route reads the raw body + `stripe-signature` header + `STRIPE_WEBHOOK_SECRET` and calls `stripe.webhooks.constructEvent(body, signature, secret)` (synchronous, route line ~43). The mock above mirrors that.

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/webhook-gift-card.test.ts`
Expected: FAIL (no debit happens).

- [ ] **Step 3: Modify `app/api/stripe/webhook/route.ts`**

Add the import:

```typescript
import { redeem } from "@/lib/gift-card-storage";
```

In the `payment_intent.succeeded` case, inside the existing `if (order && !wasAlreadyPaid) { ... }` block, **before** `notifyOrderPaid(order)`, add:

```typescript
    if (order.giftCardId && order.giftCardCents && order.giftCardCents > 0) {
      try {
        redeem(order.giftCardId, order.id, order.giftCardCents);
      } catch (e) {
        // Order is paid; balance is single-shop courtesy. Log + alert instead of failing the webhook.
        console.error("[gift-card] redeem on payment success failed for order", order.id, e);
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/webhook-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts tests/unit/webhook-gift-card.test.ts
git commit -m "feat(gift-cards): commit redemption on payment_intent.succeeded"
```

---

### Task 17: Web checkout UI — gift card field + reduced total + skip-Stripe

**Files:**
- Create: `components/checkout/GiftCardField.tsx`
- Modify: `components/checkout/CheckoutShell.tsx`
- Test: `tests/unit/GiftCardField.test.tsx`

- [ ] **Step 1: Write the failing component test**

`tests/unit/GiftCardField.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GiftCardField from "@/components/checkout/GiftCardField";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GiftCardField", () => {
  it("applies a valid code and reports the applied amount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: true, code: "DIVA-7K2M-9XQ4", balanceCents: 15000 }), { status: 200 }),
    );
    const onApply = vi.fn();
    render(<GiftCardField totalCents={9000} onApply={onApply} onClear={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/DIVA/i), { target: { value: "diva 7k2m 9xq4" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar|apply/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ code: "DIVA-7K2M-9XQ4", appliedCents: 9000 }));
  });

  it("shows an error for an invalid code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: false, reason: "invalid" }), { status: 200 }),
    );
    render(<GiftCardField totalCents={9000} onApply={() => {}} onClear={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/DIVA/i), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar|apply/i }));
    await waitFor(() => expect(screen.getByText(/inválid|invalid/i)).toBeDefined());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/GiftCardField.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Write `GiftCardField.tsx`**

`components/checkout/GiftCardField.tsx`:

```typescript
"use client";
import { useState } from "react";

type Applied = { code: string; appliedCents: number };

export default function GiftCardField({
  totalCents,
  onApply,
  onClear,
}: {
  totalCents: number;
  onApply: (a: Applied) => void;
  onClear: () => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/gift-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.valid) {
        setError("Código inválido o sin saldo / Invalid or empty code");
        return;
      }
      const appliedCents = Math.min(data.balanceCents, totalCents);
      const a = { code: data.code, appliedCents };
      setApplied(a);
      onApply(a);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setApplied(null);
    setCode("");
    setError(null);
    onClear();
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-700/30 bg-green-700/10 px-3 py-2 text-sm">
        <span>✓ Gift card <strong>{applied.code}</strong> · −${(applied.appliedCents / 100).toFixed(2)}</span>
        <button type="button" onClick={clear} className="opacity-60">quitar ✕</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="DIVA-XXXX-XXXX"
          className="flex-1 rounded-lg border border-ink/20 px-3 py-2 font-mono text-sm"
        />
        <button type="button" onClick={apply} disabled={busy || !code} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bone disabled:opacity-50">
          Aplicar
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-rouge">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `CheckoutShell.tsx`**

In `components/checkout/CheckoutShell.tsx`:

1. Import the field and add state:

```typescript
import GiftCardField from "./GiftCardField";
// inside the component:
const [giftCard, setGiftCard] = useState<{ code: string; appliedCents: number } | null>(null);
```

2. Render `<GiftCardField>` in the payment area (near `OrderSummaryPanel`), passing the current total:

```tsx
<GiftCardField
  totalCents={totals.totalCents}
  onApply={(a) => setGiftCard(a)}
  onClear={() => setGiftCard(null)}
/>
```

3. Compute the payable amount and pass it to the summary panel (replace the `total={totals.totalCents}` prop on `OrderSummaryPanel` with the reduced value, and show the gift card line):

```typescript
const payableCents = Math.max(0, totals.totalCents - (giftCard?.appliedCents ?? 0));
```

4. Include the code in the intent payload (the `createIntent` call body):

```typescript
const r = await createIntent({ locale, lines, form, giftCardCode: giftCard?.code });
```
and widen `createIntent`'s payload type to include `giftCardCode?: string` and its return type to include `{ paid: true; orderId: string }`.

5. Handle the `{ paid: true }` response — skip the Stripe step and go straight to confirmation. Where the response is consumed, branch before setting the Stripe intent state:

```typescript
if ("paid" in r && r.paid) {
  clear();
  closeDrawer();
  router.push(`/${locale}/order/${r.orderId}/confirmation`);
  return;
}
```

> Refer to the exact lines reported for `CheckoutShell.tsx` (the `createIntent` definition ~L42–58, response handling ~L199–204, success route ~L241–244). Keep the existing pickup/delivery total recompute intact; only the displayed payable and the intent payload change.

- [ ] **Step 5: Run the component test + type check**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/GiftCardField.test.tsx`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/GiftCardField.tsx components/checkout/CheckoutShell.tsx tests/unit/GiftCardField.test.tsx
git commit -m "feat(gift-cards): web checkout gift card field + skip-Stripe on \$0"
```

---

### Task 18: Intake — apply code (immediate-paid + full coverage)

**Files:**
- Modify: `schemas/intake.ts`
- Modify: `app/api/admin/orders/route.ts`
- Modify: `components/admin/intake/IntakeForm.tsx`
- Test: `tests/unit/intake-gift-card.test.ts`

**Scope:** Phase 1 supports gift cards for intake orders that are **paid immediately** (cash/zelle/card-terminal → debit now) and **fully covered** (→ mark paid by gift card). Combining a gift card with a *pending SMS/WhatsApp payment link for the remainder* is deferred (documented limitation) because it requires changing the Stripe Checkout Session amount construction; if a gift card is present, the intake order is expected to be marked paid.

- [ ] **Step 1: Write the failing test**

`tests/unit/intake-gift-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";
import { getOrder } from "@/lib/order-storage";

vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => {}) }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
// Verified intake imports: dispatchOrderReceived is from @/lib/order-dispatch (NOT @/lib/messaging);
// createCheckoutSession is from @/lib/stripe-payment-link but only fires for pending sms/whatsapp orders,
// so a paid cash order never reaches it. upsertOnOrder (customer-storage) writes to the migrated DB and needs no mock.
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intake-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function intakeBody(code: string) {
  return {
    source: "walk-in",
    customer: { name: "Cliente", phone: "5165550100" },
    fulfillment: { method: "pickup", recipient: { name: "Cliente", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    giftCardCode: code,
    payment: { status: "paid", method: "cash" },
  };
}

describe("intake with gift card", () => {
  it("debits the gift card when the order is paid immediately", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/orders/route");
    const res = await POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(intakeBody(card.code)) }));
    const data = await res.json();
    const order = await getOrder(data.orderId);
    expect(order?.giftCardId).toBe(card.id);
    expect(order?.giftCardCents).toBeGreaterThan(0);
    expect(getGiftCardById(card.id)!.balanceCents).toBeLessThan(15000);
  });
});
```

> Side-effect imports in the intake route (verified): `enqueuePrintJob` (`@/lib/print-queue`), `dispatchOrderReceived` (`@/lib/order-dispatch`), `createCheckoutSession` (`@/lib/stripe-payment-link`), `upsertOnOrder` (`@/lib/customer-storage`). The mocks above cover the ones that touch the network for a paid cash order.

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/intake-gift-card.test.ts`
Expected: FAIL (schema rejects `giftCardCode` / no debit).

- [ ] **Step 3: Add `giftCardCode` to `schemas/intake.ts`**

Add a top-level optional field (next to `internalNotes`):

```typescript
  giftCardCode: z.string().min(1).max(50).optional(),
```

- [ ] **Step 4: Apply + debit in `app/api/admin/orders/route.ts`**

Add imports:

```typescript
import { validateForRedemption, redeem } from "@/lib/gift-card-storage";
```

After `computeTotals(input)` is available and the `order` object is built (before `await saveOrder(order)`), compute and attach the gift card:

```typescript
  let giftCardId: string | undefined;
  let giftCardCents = 0;
  if (input.giftCardCode) {
    const check = validateForRedemption(input.giftCardCode, order.totals.totalCents);
    if (!check.ok) {
      return NextResponse.json({ errors: { formErrors: ["gift_card_invalid"] } }, { status: 400 });
    }
    giftCardId = check.card.id;
    giftCardCents = check.applicableCents;
    order.giftCardId = giftCardId;
    order.giftCardCents = giftCardCents || undefined;
    // Full coverage → mark paid by gift card regardless of the chosen method.
    if (order.totals.totalCents - giftCardCents <= 0) {
      order.paymentStatus = "paid";
      order.paymentMethod = "gift-card";
      order.paidAt = now;
    }
  }
```

After `await saveOrder(order);`, commit the debit when the order is paid:

```typescript
  if (giftCardId && order.paymentStatus === "paid") {
    try {
      redeem(giftCardId, order.id, giftCardCents);
    } catch (e) {
      console.error("[gift-card] intake redeem failed for order", order.id, e);
    }
  }
```

> The pending-with-payment-link path (creating a Stripe session for a remainder while also applying a gift card) is out of Phase-1 scope — see the scope note above. The order still records `giftCardId`/`giftCardCents`; the debit just does not fire until the order is marked paid.

- [ ] **Step 5: Add the gift card input to `IntakeForm.tsx`**

In `components/admin/intake/IntakeForm.tsx`, add a controlled `giftCardCode` state and a text input in the totals/payment area; include it in the POST body to `/api/admin/orders`:

```tsx
// state
const [giftCardCode, setGiftCardCode] = useState("");
// input (near the payment selector)
<label className="block">
  <span className="mb-1 block text-xs font-semibold">Gift card</span>
  <input value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} placeholder="DIVA-XXXX-XXXX" className="w-full rounded-lg border border-ink/20 px-3 py-2 font-mono" />
</label>
// in the submit payload:
giftCardCode: giftCardCode || undefined,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/intake-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add schemas/intake.ts app/api/admin/orders/route.ts components/admin/intake/IntakeForm.tsx tests/unit/intake-gift-card.test.ts
git commit -m "feat(gift-cards): apply code in intake (immediate-paid + full coverage)"
```

---

### Task 19: Restore balance on cancel/refund

**Files:**
- Modify: `app/api/admin/orders/[id]/cancel/route.ts`
- Test: `tests/unit/cancel-restores-gift-card.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/cancel-restores-gift-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById, redeem } from "@/lib/gift-card-storage";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-cancel-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("cancel restores gift card balance", () => {
  it("credits the used amount back when an order with a gift card is canceled", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const order: Order = {
      id: "do_cancel", source: "web", locale: "es",
      lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
      fulfillment: { method: "pickup", recipient: { name: "M", phone: "5165550100" }, window: { date: "2026-07-01", slot: "midday" } },
      contact: { phone: "5165550100", email: "a@b.com" },
      totals: { subtotalCents: 9000, deliveryCents: 0, taxCents: 776, totalCents: 9776 },
      status: "pending", paymentStatus: "paid", paymentMethod: "gift-card",
      giftCardId: card.id, giftCardCents: 9776,
      createdAt: "2026-06-22T00:00:00Z", updatedAt: "2026-06-22T00:00:00Z",
    };
    await saveOrder(order);
    redeem(card.id, order.id, 9776);
    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000 - 9776);

    const { POST } = await import("@/app/api/admin/orders/[id]/cancel/route");
    await POST(new Request("http://t", { method: "POST" }), { params: Promise.resolve({ id: "do_cancel" }) });

    expect(getGiftCardById(card.id)!.balanceCents).toBe(15000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/cancel-restores-gift-card.test.ts`
Expected: FAIL (balance not restored).

- [ ] **Step 3: Modify `app/api/admin/orders/[id]/cancel/route.ts`**

Add imports and, after the order is loaded and before/after it is marked canceled, restore the balance:

```typescript
import { getOrder } from "@/lib/order-storage";
import { refund } from "@/lib/gift-card-storage";
// inside POST, after resolving { id } and confirming the order exists:
const order = await getOrder(id);
if (order?.giftCardId && order.giftCardCents && order.giftCardCents > 0) {
  try {
    refund(order.giftCardId, order.id, order.giftCardCents);
  } catch (e) {
    console.error("[gift-card] refund on cancel failed for order", id, e);
  }
}
```

> Match the existing structure of the cancel route (it already loads/updates the order). Place the `refund()` call alongside that logic; `refund` is idempotent so a double-cancel won't over-credit.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/cancel-restores-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/cancel/route.ts tests/unit/cancel-restores-gift-card.test.ts
git commit -m "feat(gift-cards): restore balance when an order is canceled"
```

---

### Task 20: Shop confirmation email shows the gift card line

**Files:**
- Modify: `lib/order-notifications.ts`
- Test: `tests/unit/order-notifications-gift-card.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/order-notifications-gift-card.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { __buildBody as buildBody } from "@/lib/order-notifications";

const order: Order = {
  id: "do_1", source: "web", locale: "en",
  lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }],
  contact: { email: "buyer@example.com", phone: "5165551234" },
  totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
  status: "pending", paymentStatus: "paid",
  giftCardId: "gc_1", giftCardCents: 15000,
  createdAt: "2026-06-22T00:00:00Z", updatedAt: "2026-06-22T00:00:00Z",
  fulfillment: { method: "pickup", recipient: { name: "Lola", phone: "5165550101" }, window: { date: "2026-07-01", slot: "midday" } },
};

describe("order confirmation with gift card", () => {
  it("shows the gift card amount applied", () => {
    const body = buildBody(order);
    expect(body).toMatch(/gift card/i);
    expect(body).toContain("$150.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/order-notifications-gift-card.test.ts`
Expected: FAIL (no gift card line).

- [ ] **Step 3: Modify `lib/order-notifications.ts`**

In `__buildBody(order)`, where the totals are rendered, add a line when `order.giftCardCents` is set:

```typescript
  if (order.giftCardCents && order.giftCardCents > 0) {
    lines.push(`Gift card: -$${(order.giftCardCents / 100).toFixed(2)}`);
  }
```

In `__buildHtml(order)`, add an equivalent row to the totals table (mirror the existing subtotal/tax row markup):

```typescript
  // inside the totals table, after the tax row:
  ${order.giftCardCents && order.giftCardCents > 0
    ? `<tr><td style="padding:4px 0;">Gift card</td><td style="padding:4px 0;text-align:right;">-$${(order.giftCardCents / 100).toFixed(2)}</td></tr>`
    : ""}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/order-notifications-gift-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/order-notifications.ts tests/unit/order-notifications-gift-card.test.ts
git commit -m "feat(gift-cards): show gift card line on shop confirmation email"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run`
Expected: all tests pass.

- [ ] **Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Manual smoke (dev server)**

1. `/es/admin/gift-cards` → issue a $150 card to a real inbox → email arrives (direction B) with a `DIVA-…` code.
2. Web checkout an order < $150 → apply the code → "A pagar $0.00" → confirm → confirmation page; card balance shows the remainder; card still listed as "Usada parcial".
3. Web checkout an order > $150 → apply the code → pay the remainder via Stripe → webhook debits the card to $0 ("Agotada").
4. Intake: create a paid (cash) order with the code → balance debits.
5. Cancel a gift-card order from the dashboard → balance restored.

---

## Spec coverage check (self-review)

| Spec requirement | Task(s) |
|---|---|
| `gift_cards` + `gift_card_redemptions` tables, orders columns | 1 |
| Code `DIVA-XXXX-XXXX`, unambiguous, normalized | 2 |
| Domain types + `GiftCardPublic` | 3 |
| Issue (balance, 1-yr expiry), lookup, display status | 4 |
| Stored-value redeem/refund/void, concurrency, partial/overflow | 5 |
| List + liability stats + history | 6 |
| Issue-form schema ($150 only) | 7 |
| Recipient email (Resend, direction B), resend-safe | 8 |
| Admin issue + list API (issued_by = "maky") | 9 |
| Detail / void / resend API | 10 |
| i18n | 11 |
| Admin UI (list, form, detail, nav) | 12 |
| Order tender fields, gift-card payment method | 13 |
| Checkout preview validation | 14 |
| Intent apply: partial + $0 full coverage, tax on full price | 15 |
| Debit-on-paid (webhook) | 16 |
| Web checkout UI + skip-Stripe | 17 |
| Intake apply + debit | 18 |
| Refund/cancel restores balance | 19 |
| Shop confirmation email gift card line | 20 |
| Phase 2 selling / variable amounts / NY 9-yr | Out of scope (documented in spec) |

**Known Phase-1 limitations (documented, intentional):**
- Intake gift card + *pending SMS-link-for-remainder* is deferred (Task 18 scope note); use mark-as-paid for gift-card intake orders.
- The rare race where a partial-coverage card is emptied between intent and webnook commit logs + alerts rather than blocking (Task 16) — acceptable for a single-shop courtesy program.
