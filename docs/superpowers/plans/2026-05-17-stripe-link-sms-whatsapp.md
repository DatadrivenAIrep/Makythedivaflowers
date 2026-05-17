# Stripe payment links + SMS/WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate Stripe Checkout Sessions for pending-payment intake orders and dispatch order confirmations + payment links via Twilio (SMS now; WhatsApp gated until Meta approves templates). Add a 4-chip channel picker to the intake form, store the preference on the customer record, and audit every send in a new `messages` table.

**Architecture:** A new channel-agnostic `lib/messaging.ts` is called from both the intake order POST and the Stripe webhook. Internally it routes to `lib/twilio-server.ts` (SMS/WhatsApp) or skips (email — handled by the existing email pipeline). All template copy lives in `lib/messaging-templates.ts` so changes are data, not code. Stripe Checkout Sessions are created inline in the order POST when payment is pending; their `id` is stored on the order so the webhook can reconcile and trigger `payment_confirmed`. Feature flags `TWILIO_SMS_ENABLED`, `TWILIO_WHATSAPP_ENABLED`, and `TWILIO_DRY_RUN` control the runtime.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Zod, `better-sqlite3` (Phase 1), `twilio` SDK, Stripe SDK (Phase 1), `react-hook-form` (Phase 1), Tailwind v4, vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-stripe-link-sms-whatsapp-design.md`

---

### Task 1: Install Twilio + env scaffolding

**Files:**
- Modify: `package.json` (add `twilio`)
- Modify: `next.config.ts` (externalize `twilio` so it isn't bundled client-side)
- Create: `.env.local.example` (or extend existing) with Phase 2 env vars

- [ ] **Step 1: Install the runtime**

Run: `pnpm add twilio`
Expected: `package.json` gains `"twilio"` under dependencies; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Externalize for Next.js**

Open `next.config.ts` and append `"twilio"` to the `serverExternalPackages` array:

```ts
serverExternalPackages: [
  "puppeteer-core",
  "@sparticuz/chromium",
  "sharp",
  "pdf-parse",
  "better-sqlite3",
  "twilio",
],
```

- [ ] **Step 3: Document env vars**

Create `.env.local.example` if absent, append the Phase 2 block (preserve existing content):

```
# Phase 2 — messaging + payment links
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_FROM=
TWILIO_SMS_ENABLED=false
TWILIO_WHATSAPP_ENABLED=false
TWILIO_DRY_RUN=true

TWILIO_TEMPLATE_ORDER_RECEIVED_EN=
TWILIO_TEMPLATE_ORDER_RECEIVED_ES=
TWILIO_TEMPLATE_PAYMENT_LINK_EN=
TWILIO_TEMPLATE_PAYMENT_LINK_ES=
TWILIO_TEMPLATE_PAYMENT_CONFIRMED_EN=
TWILIO_TEMPLATE_PAYMENT_CONFIRMED_ES=
```

- [ ] **Step 4: Verify build still succeeds**

Run: `pnpm build`
Expected: Build succeeds. `twilio` does not appear in the client bundle.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts .env.local.example
git commit -m "chore(messaging): add twilio + env scaffolding"
```

---

### Task 2: Schema migration `002_messaging.sql`

**Files:**
- Create: `db/migrations/002_messaging.sql`
- Create/Modify: `tests/unit/db-migrate.test.ts` (extend to verify migration 002 applies)

- [ ] **Step 1: Write the migration SQL**

Create `db/migrations/002_messaging.sql`:

```sql
ALTER TABLE customers ADD COLUMN messaging_channel TEXT;
ALTER TABLE customers ADD COLUMN locale TEXT;

ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  customer_id  TEXT,
  channel      TEXT NOT NULL,
  template     TEXT NOT NULL,
  locale       TEXT NOT NULL,
  to_phone     TEXT,
  to_email     TEXT,
  provider_sid TEXT,
  status       TEXT NOT NULL,
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
```

- [ ] **Step 2: Extend the migration test**

Append to `tests/unit/db-migrate.test.ts`:

```ts
describe("002_messaging migration", () => {
  it("adds messaging_channel + locale to customers", () => {
    runMigrations();
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(customers)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("messaging_channel");
    expect(names).toContain("locale");
  });

  it("adds stripe_checkout_session_id to orders", () => {
    runMigrations();
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain("stripe_checkout_session_id");
  });

  it("creates the messages table", () => {
    runMigrations();
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("messages");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/unit/db-migrate.test.ts`
Expected: All tests pass (Phase 1's 2 + Phase 2's 3 new).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/002_messaging.sql tests/unit/db-migrate.test.ts
git commit -m "feat(db): migration 002 — messaging_channel, locale, messages table"
```

---

### Task 3: Extend types + customer-storage

**Files:**
- Modify: `types/order.ts`
- Modify: `lib/customer-storage.ts`
- Modify: `tests/unit/customer-storage.test.ts`

- [ ] **Step 1: Extend the types**

Open `types/order.ts` and add the new types alongside the existing ones. Add to the top section (after existing union types):

```ts
export type MessagingChannel = "sms" | "whatsapp" | "email" | "none";
```

Modify the existing `Order` type to add the optional Stripe session id (only add the new field; keep all existing fields):

```ts
export type Order = {
  // ... all existing fields, unchanged ...
  stripeCheckoutSessionId?: string;
};
```

There is no `Customer` type in `types/order.ts` — the `Customer` type lives in `lib/customer-storage.ts`. Skip touching `Customer` here; Task 3 step 2 extends it in `lib/customer-storage.ts`.

- [ ] **Step 2: Extend `Customer` + `UpsertInput` + row mapper in `lib/customer-storage.ts`**

Read the current `lib/customer-storage.ts`. Modify the `Customer` type:

```ts
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lastAddress?: Address;
  orderCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  messagingChannel?: MessagingChannel;  // NEW
  locale?: "en" | "es";                 // NEW
};
```

Add the import at the top:

```ts
import type { MessagingChannel } from "@/types/order";
```

Modify `CustomerRow`:

```ts
type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  last_address_json: string | null;
  order_count: number;
  first_seen_at: string;
  last_seen_at: string;
  messaging_channel: string | null;  // NEW
  locale: string | null;             // NEW
};
```

Modify `rowToCustomer`:

```ts
function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    lastAddress: r.last_address_json ? (JSON.parse(r.last_address_json) as Address) : undefined,
    orderCount: r.order_count,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    messagingChannel: (r.messaging_channel as MessagingChannel | null) ?? undefined,
    locale: (r.locale as "en" | "es" | null) ?? undefined,
  };
}
```

Modify `UpsertInput`:

```ts
export type UpsertInput = {
  name: string;
  phone: string;
  email?: string;
  address?: Address;
  orderAt: string;
  messagingChannel?: MessagingChannel;  // NEW
  locale?: "en" | "es";                 // NEW
};
```

Modify both branches of `upsertOnOrder`. For the **UPDATE branch**, replace the SQL:

```ts
db.prepare(
  `UPDATE customers SET
     name = ?, email = COALESCE(?, email),
     last_address_json = COALESCE(?, last_address_json),
     order_count = order_count + 1,
     last_seen_at = ?,
     messaging_channel = COALESCE(?, messaging_channel),
     locale = COALESCE(?, locale)
   WHERE id = ?`,
).run(
  input.name,
  input.email ?? null,
  input.address ? JSON.stringify(input.address) : null,
  input.orderAt,
  input.messagingChannel ?? null,
  input.locale ?? null,
  existing.id,
);
```

For the **INSERT branch**:

```ts
db.prepare(
  `INSERT INTO customers (
     id, name, phone, email, last_address_json,
     order_count, first_seen_at, last_seen_at,
     messaging_channel, locale
   ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
).run(
  id,
  input.name,
  phone,
  input.email ?? null,
  input.address ? JSON.stringify(input.address) : null,
  input.orderAt,
  input.orderAt,
  input.messagingChannel ?? null,
  input.locale ?? null,
);
```

- [ ] **Step 3: Add a test**

Append to `tests/unit/customer-storage.test.ts`:

```ts
describe("messaging preferences", () => {
  it("upsertOnOrder persists messagingChannel + locale", () => {
    const c = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "whatsapp",
      locale: "es",
    });
    expect(c.messagingChannel).toBe("whatsapp");
    expect(c.locale).toBe("es");
  });

  it("upsertOnOrder preserves existing preferences when omitted on update", () => {
    upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "whatsapp",
      locale: "es",
    });
    const c2 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T11:00:00Z",
    });
    expect(c2.messagingChannel).toBe("whatsapp");
    expect(c2.locale).toBe("es");
  });

  it("upsertOnOrder overwrites preferences when explicitly provided", () => {
    upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "sms",
    });
    const c2 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T11:00:00Z",
      messagingChannel: "whatsapp",
    });
    expect(c2.messagingChannel).toBe("whatsapp");
  });
});
```

- [ ] **Step 4: Type check + test**

Run: `pnpm tsc --noEmit && pnpm test tests/unit/customer-storage.test.ts`
Expected: zero errors; 6 tests pass (3 from Phase 1 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add types/order.ts lib/customer-storage.ts tests/unit/customer-storage.test.ts
git commit -m "feat(customer): messagingChannel + locale preferences"
```

---

### Task 4: `lib/twilio-server.ts`

**Files:**
- Create: `lib/twilio-server.ts`
- Create: `tests/unit/twilio-server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/twilio-server.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { e164, getTwilioClient } from "@/lib/twilio-server";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("e164", () => {
  it("normalizes a 10-digit US number", () => {
    expect(e164("5165550100")).toBe("+15165550100");
  });
  it("normalizes a formatted US number", () => {
    expect(e164("(516) 555-0100")).toBe("+15165550100");
  });
  it("normalizes an 11-digit number starting with 1", () => {
    expect(e164("15165550100")).toBe("+15165550100");
  });
  it("passes through an already-formatted international number", () => {
    expect(e164("+525512345678")).toBe("+525512345678");
  });
});

describe("getTwilioClient", () => {
  it("returns null when credentials are missing", () => {
    expect(getTwilioClient()).toBeNull();
  });

  it("returns a client when credentials are set", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test_token_value_at_least_32_chars");
    const client = getTwilioClient();
    expect(client).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test tests/unit/twilio-server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/twilio-server.ts`**

```ts
import "server-only";
import twilio, { type Twilio } from "twilio";

let cachedClient: Twilio | null = null;

export function getTwilioClient(): Twilio | null {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  cachedClient = twilio(sid, token);
  return cachedClient;
}

// Test hook only — vitest stubEnv changes envs but the singleton can leak.
export function __resetTwilioClient(): void {
  cachedClient = null;
}

export function e164(phone: string): string {
  if (phone.startsWith("+")) {
    const rest = phone.slice(1).replace(/\D/g, "");
    return `+${rest}`;
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const c = getTwilioClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("twilio_from_missing");
  const msg = await c.messages.create({ to: e164(to), from, body });
  return { sid: msg.sid };
}

export async function sendWhatsApp(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>,
): Promise<{ sid: string }> {
  const c = getTwilioClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("twilio_whatsapp_from_missing");
  const msg = await c.messages.create({
    to: `whatsapp:${e164(to)}`,
    from,
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  });
  return { sid: msg.sid };
}
```

Note: `getTwilioClient` caches the SDK instance. The `__resetTwilioClient` helper is exported for tests so `vi.stubEnv` changes can take effect between tests; production callers must NOT use it.

Also: update the test to use the reset helper between cases that change env:

```ts
import { e164, getTwilioClient, __resetTwilioClient } from "@/lib/twilio-server";

beforeEach(() => {
  __resetTwilioClient();
  vi.unstubAllEnvs();
});
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test tests/unit/twilio-server.test.ts`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/twilio-server.ts tests/unit/twilio-server.test.ts
git commit -m "feat(messaging): twilio wrapper with sms + whatsapp + e164"
```

---

### Task 5: `lib/message-storage.ts` (audit log)

**Files:**
- Create: `lib/message-storage.ts`
- Create: `tests/unit/message-storage.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/message-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { insertMessage, updateMessage, recentMessagesForOrder } from "@/lib/message-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("message-storage", () => {
  it("insertMessage creates a queued row and returns its id", () => {
    const id = insertMessage({
      orderId: "do_test",
      customerId: "cus_1",
      channel: "sms",
      template: "order_received",
      locale: "en",
      toPhone: "+15165550100",
      toEmail: undefined,
    });
    expect(id).toMatch(/^msg_/);
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("queued");
    expect(rows[0].channel).toBe("sms");
  });

  it("updateMessage transitions queued → sent and records provider_sid", () => {
    const id = insertMessage({
      orderId: "do_test",
      channel: "sms",
      template: "order_received",
      locale: "en",
      toPhone: "+15165550100",
    });
    updateMessage(id, { status: "sent", providerSid: "SM123" });
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].providerSid).toBe("SM123");
  });

  it("recentMessagesForOrder filters by orderId and orders by created_at DESC", () => {
    insertMessage({ orderId: "do_a", channel: "sms", template: "order_received", locale: "en", toPhone: "+1" });
    insertMessage({ orderId: "do_b", channel: "sms", template: "order_received", locale: "en", toPhone: "+2" });
    insertMessage({ orderId: "do_a", channel: "sms", template: "payment_link", locale: "en", toPhone: "+1" });
    const rows = recentMessagesForOrder("do_a", 10);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.orderId === "do_a")).toBe(true);
  });
});
```

- [ ] **Step 2: Confirm fail**

Run: `pnpm test tests/unit/message-storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/message-storage.ts`**

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type MessageChannel = "sms" | "whatsapp" | "email";
export type MessageTemplate = "order_received" | "payment_link" | "payment_confirmed";
export type MessageStatus = "queued" | "sent" | "failed" | "skipped";

export type Message = {
  id: string;
  orderId: string;
  customerId?: string;
  channel: MessageChannel;
  template: MessageTemplate;
  locale: "en" | "es";
  toPhone?: string;
  toEmail?: string;
  providerSid?: string;
  status: MessageStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type InsertInput = Omit<Message, "id" | "status" | "createdAt" | "updatedAt" | "providerSid" | "error">;

type MessageRow = {
  id: string;
  order_id: string;
  customer_id: string | null;
  channel: string;
  template: string;
  locale: string;
  to_phone: string | null;
  to_email: string | null;
  provider_sid: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    orderId: r.order_id,
    customerId: r.customer_id ?? undefined,
    channel: r.channel as MessageChannel,
    template: r.template as MessageTemplate,
    locale: r.locale as "en" | "es",
    toPhone: r.to_phone ?? undefined,
    toEmail: r.to_email ?? undefined,
    providerSid: r.provider_sid ?? undefined,
    status: r.status as MessageStatus,
    error: r.error ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function insertMessage(input: InsertInput): string {
  runMigrations();
  const id = newId();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO messages
         (id, order_id, customer_id, channel, template, locale, to_phone, to_email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    )
    .run(
      id,
      input.orderId,
      input.customerId ?? null,
      input.channel,
      input.template,
      input.locale,
      input.toPhone ?? null,
      input.toEmail ?? null,
      now,
      now,
    );
  return id;
}

export type UpdateInput = {
  status: MessageStatus;
  providerSid?: string;
  error?: string;
};

export function updateMessage(id: string, patch: UpdateInput): void {
  runMigrations();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE messages SET status = ?, provider_sid = COALESCE(?, provider_sid), error = ?, updated_at = ? WHERE id = ?`,
    )
    .run(patch.status, patch.providerSid ?? null, patch.error ?? null, now, id);
}

export function recentMessagesForOrder(orderId: string, limit: number): Message[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT * FROM messages WHERE order_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(orderId, limit) as MessageRow[];
  return rows.map(rowToMessage);
}

export function hasRecentSuccess(
  orderId: string,
  template: MessageTemplate,
  hoursAgo: number,
): boolean {
  runMigrations();
  const cutoff = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT id FROM messages
       WHERE order_id = ? AND template = ? AND status = 'sent' AND created_at > ?
       LIMIT 1`,
    )
    .get(orderId, template, cutoff) as { id: string } | undefined;
  return !!row;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/message-storage.test.ts`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/message-storage.ts tests/unit/message-storage.test.ts
git commit -m "feat(messaging): message audit storage"
```

---

### Task 6: `lib/messaging-templates.ts` (copy + render)

**Files:**
- Create: `lib/messaging-templates.ts`
- Create: `tests/unit/messaging-templates.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/messaging-templates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderSmsBody, whatsappContentVars, type TemplateVars } from "@/lib/messaging-templates";

const vars: TemplateVars = {
  recipient_name: "Lola",
  total: "$205.51",
  window: "Sat May 17 · afternoon (12–4 pm)",
  link: "https://buy.stripe.com/test_abc123",
  shop_phone: "(516) 484-3456",
};

describe("renderSmsBody", () => {
  it("renders order_received in English", () => {
    const body = renderSmsBody("order_received", "en", vars);
    expect(body).toContain("Hi Lola");
    expect(body).toContain("$205.51");
    expect(body).toContain("(516) 484-3456");
  });

  it("renders order_received in Spanish", () => {
    const body = renderSmsBody("order_received", "es", vars);
    expect(body).toContain("Hola Lola");
    expect(body).toContain("recibió tu pedido");
  });

  it("renders payment_link with the URL", () => {
    const body = renderSmsBody("payment_link", "en", vars);
    expect(body).toContain("buy.stripe.com/test_abc123");
  });

  it("renders payment_confirmed in Spanish", () => {
    const body = renderSmsBody("payment_confirmed", "es", vars);
    expect(body).toContain("¡Gracias Lola");
    expect(body).toContain("Recibimos tu pago");
  });

  it("keeps SMS bodies under 160 chars in English with realistic vars", () => {
    expect(renderSmsBody("order_received", "en", vars).length).toBeLessThanOrEqual(160);
    expect(renderSmsBody("payment_link", "en", vars).length).toBeLessThanOrEqual(160);
    expect(renderSmsBody("payment_confirmed", "en", vars).length).toBeLessThanOrEqual(160);
  });
});

describe("whatsappContentVars", () => {
  it("returns numbered slots for order_received", () => {
    const slots = whatsappContentVars("order_received", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("$205.51");
    expect(slots["3"]).toBe("Sat May 17 · afternoon (12–4 pm)");
    expect(slots["4"]).toBe("(516) 484-3456");
  });

  it("returns numbered slots for payment_link", () => {
    const slots = whatsappContentVars("payment_link", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("$205.51");
    expect(slots["3"]).toBe("https://buy.stripe.com/test_abc123");
  });

  it("returns numbered slots for payment_confirmed", () => {
    const slots = whatsappContentVars("payment_confirmed", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("Sat May 17 · afternoon (12–4 pm)");
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test tests/unit/messaging-templates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/messaging-templates.ts`**

```ts
import "server-only";
import type { MessageTemplate } from "@/lib/message-storage";

export type TemplateVars = {
  recipient_name: string;
  total: string;
  window?: string;
  link?: string;
  shop_phone: string;
};

const BODIES: Record<"en" | "es", Record<MessageTemplate, (v: TemplateVars) => string>> = {
  en: {
    order_received: (v) =>
      `Hi ${v.recipient_name}, Diva Flowers got your order. Total ${v.total}. Delivery ${v.window ?? ""}. Thanks! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hi ${v.recipient_name}, your Diva Flowers order is reserved. Total ${v.total}. Pay here: ${v.link ?? ""}. Delivery confirmed once paid. — Maky`,
    payment_confirmed: (v) =>
      `Thanks ${v.recipient_name}! Payment received. We're prepping your arrangement now. Delivery ${v.window ?? ""}. — Maky`,
  },
  es: {
    order_received: (v) =>
      `Hola ${v.recipient_name}, Diva Flowers recibió tu pedido. Total ${v.total}. Entrega ${v.window ?? ""}. ¡Gracias! — Maky · ${v.shop_phone}`,
    payment_link: (v) =>
      `Hola ${v.recipient_name}, tu pedido en Diva Flowers está reservado. Total ${v.total}. Paga aquí: ${v.link ?? ""}. Confirmamos la entrega al recibir el pago. — Maky`,
    payment_confirmed: (v) =>
      `¡Gracias ${v.recipient_name}! Recibimos tu pago. Estamos preparando tu arreglo. Entrega ${v.window ?? ""}. — Maky`,
  },
};

export function renderSmsBody(
  template: MessageTemplate,
  locale: "en" | "es",
  vars: TemplateVars,
): string {
  return BODIES[locale][template](vars);
}

// WhatsApp templates registered in Twilio Content use numbered slots {{1}}, {{2}}, …
// This function maps our named TemplateVars to those slots.
export function whatsappContentVars(
  template: MessageTemplate,
  vars: TemplateVars,
): Record<string, string> {
  switch (template) {
    case "order_received":
      return { "1": vars.recipient_name, "2": vars.total, "3": vars.window ?? "", "4": vars.shop_phone };
    case "payment_link":
      return { "1": vars.recipient_name, "2": vars.total, "3": vars.link ?? "" };
    case "payment_confirmed":
      return { "1": vars.recipient_name, "2": vars.window ?? "" };
  }
}

// Resolves the Twilio Content SID env var for a given (template, locale) pair.
// Returns null when not configured — caller MUST skip the send.
export function whatsappContentSid(
  template: MessageTemplate,
  locale: "en" | "es",
): string | null {
  const key = `TWILIO_TEMPLATE_${template.toUpperCase()}_${locale.toUpperCase()}`;
  const sid = process.env[key];
  return sid && sid.length > 0 ? sid : null;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test tests/unit/messaging-templates.test.ts`
Expected: 8/8 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/messaging-templates.ts tests/unit/messaging-templates.test.ts
git commit -m "feat(messaging): bilingual sms + whatsapp templates"
```

---

### Task 7: `lib/messaging.ts` (the abstraction)

**Files:**
- Create: `lib/messaging.ts`
- Create: `tests/unit/messaging.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/messaging.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendMessage } from "@/lib/messaging";
import { recentMessagesForOrder } from "@/lib/message-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
  vi.stubEnv("TWILIO_WHATSAPP_ENABLED", "true");
  vi.stubEnv("TWILIO_TEMPLATE_ORDER_RECEIVED_EN", "HXtest");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const baseReq = {
  orderId: "do_test",
  channel: "sms" as const,
  locale: "en" as const,
  template: "order_received" as const,
  vars: {
    recipient_name: "Lola",
    total: "$205.51",
    window: "Sat May 17 · afternoon (12–4 pm)",
    shop_phone: "(516) 484-3456",
  },
  to: { phone: "+15165550100" },
};

describe("sendMessage", () => {
  it("logs a sent row in dry-run mode for sms", async () => {
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("sent");
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].providerSid).toMatch(/^dry_run_/);
  });

  it("skips sms when TWILIO_SMS_ENABLED is not true", async () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    const res = await sendMessage(baseReq);
    expect(res.status).toBe("skipped");
    const rows = recentMessagesForOrder("do_test", 10);
    expect(rows[0].status).toBe("skipped");
  });

  it("skips whatsapp when template SID is missing for that locale", async () => {
    const res = await sendMessage({
      ...baseReq,
      channel: "whatsapp",
      locale: "es",  // no SID set for ES in this test's env
    });
    expect(res.status).toBe("skipped");
    expect(res.error).toBe("missing_whatsapp_template");
  });

  it("skips email with use_existing_email_pipeline reason", async () => {
    const res = await sendMessage({
      ...baseReq,
      channel: "email",
      to: { email: "a@b.com" },
    });
    expect(res.status).toBe("skipped");
    expect(res.error).toBe("use_existing_email_pipeline");
  });
});
```

- [ ] **Step 2: Confirm fail**

Run: `pnpm test tests/unit/messaging.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/messaging.ts`**

```ts
import "server-only";
import { renderSmsBody, whatsappContentSid, whatsappContentVars, type TemplateVars } from "@/lib/messaging-templates";
import { insertMessage, updateMessage, type MessageChannel, type MessageTemplate } from "@/lib/message-storage";
import { sendSms, sendWhatsApp } from "@/lib/twilio-server";

export type SendMessageRequest = {
  orderId: string;
  customerId?: string;
  channel: MessageChannel;
  locale: "en" | "es";
  template: MessageTemplate;
  vars: TemplateVars;
  to: { phone?: string; email?: string };
};

export type SendMessageResult = {
  id: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
};

function dryRunSid(): string {
  return `dry_run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function sendMessage(req: SendMessageRequest): Promise<SendMessageResult> {
  // Audit row first so we always have a trail, even if env is misconfigured.
  const id = insertMessage({
    orderId: req.orderId,
    customerId: req.customerId,
    channel: req.channel,
    template: req.template,
    locale: req.locale,
    toPhone: req.to.phone,
    toEmail: req.to.email,
  });

  if (req.channel === "email") {
    updateMessage(id, { status: "skipped", error: "use_existing_email_pipeline" });
    return { id, status: "skipped", error: "use_existing_email_pipeline" };
  }

  if (req.channel === "sms" && process.env.TWILIO_SMS_ENABLED !== "true") {
    updateMessage(id, { status: "skipped", error: "sms_disabled" });
    return { id, status: "skipped", error: "sms_disabled" };
  }
  if (req.channel === "whatsapp" && process.env.TWILIO_WHATSAPP_ENABLED !== "true") {
    updateMessage(id, { status: "skipped", error: "whatsapp_disabled" });
    return { id, status: "skipped", error: "whatsapp_disabled" };
  }
  if (req.channel === "whatsapp") {
    const sid = whatsappContentSid(req.template, req.locale);
    if (!sid) {
      updateMessage(id, { status: "skipped", error: "missing_whatsapp_template" });
      return { id, status: "skipped", error: "missing_whatsapp_template" };
    }
  }

  if (!req.to.phone) {
    updateMessage(id, { status: "failed", error: "no_destination_phone" });
    return { id, status: "failed", error: "no_destination_phone" };
  }

  // Dry-run path — log + audit, no network call.
  if (process.env.TWILIO_DRY_RUN === "true") {
    const body = renderSmsBody(req.template, req.locale, req.vars);
    console.log(JSON.stringify({
      event: "messaging_dry_run",
      channel: req.channel,
      to: req.to.phone,
      template: req.template,
      locale: req.locale,
      body,
    }));
    const providerSid = dryRunSid();
    updateMessage(id, { status: "sent", providerSid });
    return { id, status: "sent" };
  }

  try {
    if (req.channel === "sms") {
      const body = renderSmsBody(req.template, req.locale, req.vars);
      const { sid } = await sendSms(req.to.phone, body);
      updateMessage(id, { status: "sent", providerSid: sid });
      return { id, status: "sent" };
    } else {
      const contentSid = whatsappContentSid(req.template, req.locale)!;
      const contentVars = whatsappContentVars(req.template, req.vars);
      const { sid } = await sendWhatsApp(req.to.phone, contentSid, contentVars);
      updateMessage(id, { status: "sent", providerSid: sid });
      return { id, status: "sent" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateMessage(id, { status: "failed", error: msg });
    return { id, status: "failed", error: msg };
  }
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm test tests/unit/messaging.test.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/messaging.ts tests/unit/messaging.test.ts
git commit -m "feat(messaging): channel-agnostic sendMessage with dry-run + audit"
```

---

### Task 8: `lib/stripe-payment-link.ts`

**Files:**
- Create: `lib/stripe-payment-link.ts`
- Create: `tests/unit/stripe-payment-link.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/stripe-payment-link.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildCheckoutSessionParams } from "@/lib/stripe-payment-link";
import type { Order } from "@/types/order";

const sampleOrder: Order = {
  id: "do_test_abc",
  source: "phone",
  locale: "en",
  customerId: "cus_1",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
  },
  contact: { email: "lola@example.com", phone: "5165550100" },
  totals: { subtotalCents: 9400, deliveryCents: 1500, taxCents: 891, totalCents: 11791 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://example.com");
});

describe("buildCheckoutSessionParams", () => {
  it("includes orderId in metadata", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    expect(p.metadata?.orderId).toBe("do_test_abc");
    expect(p.client_reference_id).toBe("do_test_abc");
    expect(p.payment_intent_data?.metadata?.orderId).toBe("do_test_abc");
  });

  it("uses the order total in unit_amount", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    const item = p.line_items![0];
    expect(item.price_data!.unit_amount).toBe(11791);
    expect(item.price_data!.currency).toBe("usd");
    expect(item.quantity).toBe(1);
  });

  it("sets expires_at to ~24h from now", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    const nowSec = Math.floor(Date.now() / 1000);
    expect(p.expires_at).toBeGreaterThan(nowSec + 60 * 60 * 23);
    expect(p.expires_at).toBeLessThanOrEqual(nowSec + 60 * 60 * 24);
  });

  it("uses locale-prefixed success_url + cancel_url", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "es");
    expect(p.success_url).toBe("https://example.com/es/order/do_test_abc/confirmation");
    expect(p.cancel_url).toBe("https://example.com/es/admin/intake");
  });

  it("pre-fills customer_email when available", () => {
    const p = buildCheckoutSessionParams(sampleOrder, "en");
    expect(p.customer_email).toBe("lola@example.com");
  });

  it("omits customer_email when not present", () => {
    const noEmail: Order = { ...sampleOrder, contact: { phone: "5165550100" } };
    const p = buildCheckoutSessionParams(noEmail, "en");
    expect(p.customer_email).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test tests/unit/stripe-payment-link.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/stripe-payment-link.ts`**

```ts
import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { updateOrderCheckoutSessionId } from "@/lib/order-storage";
import type { Order } from "@/types/order";

const TWENTY_FOUR_HOURS_SECONDS = 60 * 60 * 24;

export function buildCheckoutSessionParams(
  order: Order,
  locale: "en" | "es",
): Stripe.Checkout.SessionCreateParams {
  const siteUrl = process.env.SITE_URL ?? "";
  const description =
    `${order.lines.length} item${order.lines.length === 1 ? "" : "s"}` +
    (order.fulfillment.method !== "in-store" && "window" in order.fulfillment
      ? ` · entrega ${order.fulfillment.window.date}`
      : "");

  return {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: order.totals.totalCents,
          product_data: {
            name: `Diva Flowers · pedido ${order.id}`,
            description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId: order.id },
    client_reference_id: order.id,
    customer_email: order.contact.email || undefined,
    expires_at: Math.floor(Date.now() / 1000) + TWENTY_FOUR_HOURS_SECONDS,
    success_url: `${siteUrl}/${locale}/order/${order.id}/confirmation`,
    cancel_url: `${siteUrl}/${locale}/admin/intake`,
    payment_intent_data: {
      metadata: { orderId: order.id },
    },
  };
}

export async function createCheckoutSession(
  order: Order,
  locale: "en" | "es",
): Promise<{ id: string; url: string; expiresAt: number }> {
  const params = buildCheckoutSessionParams(order, locale);
  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error("stripe_session_no_url");
  await updateOrderCheckoutSessionId(order.id, session.id);
  return { id: session.id, url: session.url, expiresAt: session.expires_at };
}
```

Note: this introduces a new helper `updateOrderCheckoutSessionId` in `lib/order-storage.ts`. Add it now:

```ts
// In lib/order-storage.ts — append to the existing exports:
export async function updateOrderCheckoutSessionId(
  orderId: string,
  sessionId: string,
): Promise<void> {
  ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE orders SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?`,
  ).run(sessionId, now, orderId);
}
```

Also extend `orderToRow` and `rowToOrder` in `lib/order-row.ts` to round-trip the new field. Add to `OrderRow` type:

```ts
export type OrderRow = {
  // ...existing fields
  stripe_checkout_session_id: string | null;
};
```

Add to `orderToRow`:

```ts
stripe_checkout_session_id: o.stripeCheckoutSessionId ?? null,
```

Add to `rowToOrder`:

```ts
stripeCheckoutSessionId: r.stripe_checkout_session_id ?? undefined,
```

And add the column to the INSERT in `upsertSqlite` (inside `lib/order-storage.ts`). Search for the existing INSERT INTO orders statement and add `stripe_checkout_session_id` to both the column list and the VALUES `@stripe_checkout_session_id`, plus add it to the `ON CONFLICT DO UPDATE SET` block.

- [ ] **Step 4: Run unit tests**

Run: `pnpm test tests/unit/stripe-payment-link.test.ts tests/unit/order-row.test.ts tests/unit/order-storage.test.ts`
Expected: all pass; round-trip preserved.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe-payment-link.ts lib/order-storage.ts lib/order-row.ts tests/unit/stripe-payment-link.test.ts
git commit -m "feat(stripe): build + create Checkout Sessions for intake orders"
```

---

### Task 9: Webhook `checkout.session.completed`

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `tests/unit/api-stripe-webhook.test.ts`
- Modify: `lib/order-storage.ts` (add `getOrderByCheckoutSessionId`)

- [ ] **Step 1: Add the order-storage helper**

Append to `lib/order-storage.ts`:

```ts
export async function getOrderByCheckoutSessionId(sessionId: string): Promise<Order | null> {
  ensureSchema();
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1")
    .get(sessionId) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}
```

- [ ] **Step 2: Failing test for the webhook**

Append to `tests/unit/api-stripe-webhook.test.ts`. The exact import/setup pattern depends on the existing file — adapt to fit. Conceptually:

```ts
describe("checkout.session.completed", () => {
  it("marks the order paid and dispatches payment_confirmed", async () => {
    // Setup: stub envs, insert an order with stripe_checkout_session_id="cs_test",
    // mock stripe.webhooks.constructEvent to return a session-completed event.
    // POST the webhook payload.
    // Assert: order.paymentStatus === "paid"; one row in messages with
    // template = "payment_confirmed" and status = "sent" (dry-run) or "skipped".
  });

  it("is idempotent — re-delivery does not double-send payment_confirmed", async () => {
    // Same setup; call the webhook twice. Assert messages table has at most one
    // row with template=payment_confirmed,status=sent.
  });
});
```

When implementing the test, mirror the existing webhook test's `constructEvent` mock and request shape.

- [ ] **Step 3: Add the case in the webhook**

Open `app/api/stripe/webhook/route.ts`. In the `switch (event.type)` block, add:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = (session.metadata?.orderId ?? session.client_reference_id) ?? null;
  if (!orderId) {
    console.log(JSON.stringify({ event: "checkout_session_completed_no_orderid", sessionId: session.id }));
    break;
  }
  // Phase 1's updateOrderStatusByPaymentIntent is idempotent on paymentStatus === "paid".
  // We use a new path that keys off the session id.
  const order = await getOrderByCheckoutSessionId(session.id);
  if (!order) break;
  if (order.paymentStatus === "paid") break;  // idempotent

  // Mark paid.
  await updateOrderPaidByCheckoutSession(session.id);

  // Send payment_confirmed via the customer's preferred channel.
  await dispatchPaymentConfirmed(order);

  break;
}
```

This calls two new helpers. Add `updateOrderPaidByCheckoutSession` to `lib/order-storage.ts`:

```ts
export async function updateOrderPaidByCheckoutSession(sessionId: string): Promise<void> {
  ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), updated_at = ? WHERE stripe_checkout_session_id = ? AND payment_status != 'paid'`,
  ).run(now, now, sessionId);
}
```

And add `dispatchPaymentConfirmed` — place this in a NEW file `lib/order-dispatch.ts` so the webhook + the intake route can share it (Task 11 also imports it):

```ts
// lib/order-dispatch.ts
import "server-only";
import { sendMessage } from "@/lib/messaging";
import { getByPhone } from "@/lib/customer-storage";
import { hasRecentSuccess } from "@/lib/message-storage";
import { SITE } from "@/data/site";
import type { Order } from "@/types/order";

function windowLabel(order: Order, locale: "en" | "es"): string {
  if (order.fulfillment.method === "in-store") return locale === "es" ? "se lo lleva" : "in-store";
  const w = order.fulfillment.window;
  // Minimal, locale-aware formatting. Production code may use a shared helper.
  const dt = new Date(`${w.date}T00:00:00`);
  const date = dt.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
  const slotEN: Record<string, string> = { morning: "morning (9–12)", midday: "midday (12–2)", afternoon: "afternoon (12–4)", evening: "evening (4–7)" };
  const slotES: Record<string, string> = { morning: "mañana (9–12)", midday: "mediodía (12–2)", afternoon: "tarde (12–4)", evening: "noche (4–7)" };
  const slot = (locale === "es" ? slotES : slotEN)[w.slot] ?? w.slot;
  return `${date} · ${slot}`;
}

function totalLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function resolveLocale(customerLocale: "en" | "es" | undefined, orderLocale: "en" | "es"): "en" | "es" {
  return customerLocale ?? orderLocale;
}

async function loadCustomer(order: Order) {
  if (order.customerId) {
    // Existing customer-storage doesn't expose getById; fall back to phone.
    return await getByPhone(order.contact.phone);
  }
  return await getByPhone(order.contact.phone);
}

export async function dispatchOrderReceived(order: Order, link?: string): Promise<void> {
  const customer = await loadCustomer(order);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);
  const template = order.paymentStatus === "pending" && link ? "payment_link" : "order_received";

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template,
    vars: {
      recipient_name: order.fulfillment.recipient.name.split(" ")[0],
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      link,
      shop_phone: SITE.contact?.phone ?? "(516) 484-3456",
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}

export async function dispatchPaymentConfirmed(order: Order): Promise<void> {
  if (hasRecentSuccess(order.id, "payment_confirmed", 24)) return;
  const customer = await loadCustomer(order);
  const channel = customer?.messagingChannel ?? "sms";
  if (channel === "none") return;
  const locale = resolveLocale(customer?.locale, order.locale);

  await sendMessage({
    orderId: order.id,
    customerId: customer?.id,
    channel,
    locale,
    template: "payment_confirmed",
    vars: {
      recipient_name: order.fulfillment.recipient.name.split(" ")[0],
      total: totalLabel(order.totals.totalCents),
      window: windowLabel(order, locale),
      shop_phone: SITE.contact?.phone ?? "(516) 484-3456",
    },
    to: { phone: order.contact.phone, email: order.contact.email },
  });
}
```

Note: `SITE.contact?.phone` should exist in `data/site.ts`. If the shape is different (e.g., `SITE.phone` flat), use what's there.

In the webhook, add the imports at the top:

```ts
import { getOrderByCheckoutSessionId, updateOrderPaidByCheckoutSession } from "@/lib/order-storage";
import { dispatchPaymentConfirmed } from "@/lib/order-dispatch";
```

- [ ] **Step 4: Run all webhook + dispatch tests**

Run: `pnpm test tests/unit/api-stripe-webhook.test.ts`
Expected: existing tests still pass + new tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts lib/order-storage.ts lib/order-dispatch.ts tests/unit/api-stripe-webhook.test.ts
git commit -m "feat(stripe): handle checkout.session.completed → mark paid + send confirmation"
```

---

### Task 10: Manual regen endpoint `POST /api/admin/orders/[id]/payment-link`

**Files:**
- Create: `app/api/admin/orders/[id]/payment-link/route.ts`
- Create: `tests/unit/api-admin-payment-link.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/api-admin-payment-link.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/admin/orders/[id]/payment-link/route";
import { saveOrder } from "@/lib/order-storage";
import { closeDb, getDb } from "@/lib/db";
import type { Order } from "@/types/order";

const fixture: Order = {
  id: "do_test_link",
  source: "phone",
  locale: "en",
  lines: [{ kind: "catalog", productId: "p1", variantId: "standard", addOnIds: [], qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
  },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 9400, deliveryCents: 1500, taxCents: 891, totalCents: 11791 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-05-17T10:00:00Z",
  updatedAt: "2026-05-17T10:00:00Z",
};

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("SITE_URL", "https://example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("TWILIO_SMS_ENABLED", "true");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function req(): Request {
  return new Request("http://localhost/api/admin/orders/do_test_link/payment-link", { method: "POST" });
}

describe("POST /api/admin/orders/[id]/payment-link", () => {
  it("404s when the order does not exist", async () => {
    const res = await POST(req(), { params: Promise.resolve({ id: "do_does_not_exist" }) });
    expect(res.status).toBe(404);
  });

  it("returns the new session URL and stores it on the order", async () => {
    // Mock stripe.checkout.sessions.create
    vi.doMock("@/lib/stripe-server", () => ({
      stripe: {
        checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_new", url: "https://buy.stripe.com/new", expires_at: 9999999999 }) } },
      },
    }));
    await saveOrder(fixture);
    const res = await POST(req(), { params: Promise.resolve({ id: "do_test_link" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://buy.stripe.com/new");
    const row = getDb().prepare("SELECT stripe_checkout_session_id FROM orders WHERE id = ?").get("do_test_link") as { stripe_checkout_session_id: string };
    expect(row.stripe_checkout_session_id).toBe("cs_new");
  });
});
```

The Stripe mock pattern above uses `vi.doMock`. If the existing test setup uses a different pattern (e.g., a shared `__mocks__` file), match it.

- [ ] **Step 2: Run — fail**

Run: `pnpm test tests/unit/api-admin-payment-link.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/orders/[id]/payment-link/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/order-storage";
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived } from "@/lib/order-dispatch";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.paymentStatus === "paid") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  try {
    const session = await createCheckoutSession(order, order.locale);
    // Re-send (this dispatches a fresh payment_link message)
    await dispatchOrderReceived({ ...order, stripeCheckoutSessionId: session.id }, session.url);
    return NextResponse.json({ url: session.url, expiresAt: session.expiresAt }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run + verify**

Run: `pnpm test tests/unit/api-admin-payment-link.test.ts`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/\[id\]/payment-link/route.ts tests/unit/api-admin-payment-link.test.ts
git commit -m "feat(intake): manual regen of stripe payment link"
```

---

### Task 11: Wire `/api/admin/orders` POST → dispatch + session

**Files:**
- Modify: `app/api/admin/orders/route.ts`
- Modify: `schemas/intake.ts`
- Modify: `tests/unit/api-admin-orders.test.ts`

- [ ] **Step 1: Extend the intake schema**

In `schemas/intake.ts`, add `messagingChannel` and `locale` to the customer block:

```ts
customer: z.object({
  phone,
  name: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal("")),
  messagingChannel: z.enum(["sms", "whatsapp", "email", "none"]).optional(),
  locale: z.enum(["en", "es"]).optional(),
}),
```

- [ ] **Step 2: Update the route**

Open `app/api/admin/orders/route.ts` and modify the POST handler. The current flow saves the order, enqueues a print job, and fires an email if paid. Add: persist messaging prefs to the customer; if pending + has SMS/WhatsApp channel, create a Stripe session; dispatch `order_received` (or `payment_link` if a session was created).

Add imports:

```ts
import { createCheckoutSession } from "@/lib/stripe-payment-link";
import { dispatchOrderReceived } from "@/lib/order-dispatch";
```

In the `upsertOnOrder` call, pass the new fields:

```ts
const customer = upsertOnOrder({
  name: input.customer.name,
  phone: input.customer.phone,
  email: input.customer.email && input.customer.email !== "" ? input.customer.email : undefined,
  address:
    input.fulfillment.method === "delivery" ? input.fulfillment.address : undefined,
  orderAt: now,
  messagingChannel: input.customer.messagingChannel,
  locale: input.customer.locale,
});
```

After `await saveOrder(order)` and `const job = await enqueuePrintJob(order)`, add the new dispatch logic:

```ts
let paymentLinkUrl: string | undefined;
const channel = customer.messagingChannel ?? "sms";
const shouldCreateLink =
  order.paymentStatus === "pending" &&
  (channel === "sms" || channel === "whatsapp");

if (shouldCreateLink) {
  try {
    const session = await createCheckoutSession(order, customer.locale ?? order.locale);
    paymentLinkUrl = session.url;
    order.stripeCheckoutSessionId = session.id;
  } catch (e) {
    console.error(JSON.stringify({ event: "checkout_session_failed", orderId: order.id, error: String(e) }));
  }
}

// Dispatch the right message. order_received OR payment_link is chosen
// internally by dispatchOrderReceived based on order.paymentStatus + link presence.
await dispatchOrderReceived(order, paymentLinkUrl);
```

Remove or leave the existing `notifyOrderPaid` block — the email pipeline stays unchanged for paid orders with an email.

- [ ] **Step 3: Extend the test**

Open `tests/unit/api-admin-orders.test.ts`. Add envs in `beforeEach`:

```ts
vi.stubEnv("TWILIO_DRY_RUN", "true");
vi.stubEnv("TWILIO_SMS_ENABLED", "true");
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
vi.stubEnv("SITE_URL", "https://example.com");
```

Mock Stripe's `checkout.sessions.create` at the top of the file (use the project's existing pattern; the in-line `vi.doMock` works if no shared mock exists):

```ts
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }),
      },
    },
  },
}));
```

Add tests:

```ts
it("creates a checkout session and dispatches payment_link for pending orders with SMS channel", async () => {
  const res = await POST(req({ ...body, payment: { status: "pending" }, customer: { ...body.customer, messagingChannel: "sms" } }));
  expect(res.status).toBe(201);
  const out = await res.json();

  const order = getDb().prepare("SELECT stripe_checkout_session_id FROM orders WHERE id = ?").get(out.orderId) as { stripe_checkout_session_id: string };
  expect(order.stripe_checkout_session_id).toBe("cs_test");

  const msg = getDb().prepare("SELECT template, status FROM messages WHERE order_id = ?").get(out.orderId) as { template: string; status: string };
  expect(msg.template).toBe("payment_link");
  expect(msg.status).toBe("sent");
});

it("dispatches order_received for paid walk-in", async () => {
  const res = await POST(req({ ...body, customer: { ...body.customer, messagingChannel: "sms" } }));
  expect(res.status).toBe(201);
  const out = await res.json();
  const msg = getDb().prepare("SELECT template FROM messages WHERE order_id = ?").get(out.orderId) as { template: string };
  expect(msg.template).toBe("order_received");
});

it("does not send any message when customer channel is 'none'", async () => {
  const res = await POST(req({ ...body, customer: { ...body.customer, messagingChannel: "none" } }));
  expect(res.status).toBe(201);
  const out = await res.json();
  const count = (getDb().prepare("SELECT COUNT(*) as c FROM messages WHERE order_id = ?").get(out.orderId) as { c: number }).c;
  expect(count).toBe(0);
});
```

- [ ] **Step 4: Run all order tests**

Run: `pnpm test tests/unit/api-admin-orders.test.ts`
Expected: all previous tests + 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/route.ts schemas/intake.ts tests/unit/api-admin-orders.test.ts
git commit -m "feat(intake): dispatch messaging + stripe link from order POST"
```

---

### Task 12: `ChannelPicker` component + wire into `CustomerBlock`

**Files:**
- Create: `components/admin/intake/ChannelPicker.tsx`
- Modify: `components/admin/intake/CustomerBlock.tsx`
- Modify: `messages/en.json`, `messages/es.json` (add chip labels)

- [ ] **Step 1: i18n strings**

Append to the `admin_intake` object in **both** `messages/en.json` and `messages/es.json`:

**EN:**
```json
"channel_pref_label": "How should we reach them",
"channel_pref_sms": "SMS",
"channel_pref_whatsapp": "WhatsApp",
"channel_pref_email": "Email only",
"channel_pref_none": "None",
"channel_pref_email_disabled_hint": "Email needed"
```

**ES:**
```json
"channel_pref_label": "Cómo lo contactamos",
"channel_pref_sms": "SMS",
"channel_pref_whatsapp": "WhatsApp",
"channel_pref_email": "Solo email",
"channel_pref_none": "Ninguno",
"channel_pref_email_disabled_hint": "Falta email"
```

- [ ] **Step 2: Build `ChannelPicker`**

Create `components/admin/intake/ChannelPicker.tsx`:

```tsx
"use client";
import { useTranslations } from "next-intl";
import type { MessagingChannel } from "@/types/order";

type Props = {
  value: MessagingChannel;
  onChange: (v: MessagingChannel) => void;
  emailAvailable: boolean;
};

const CHIPS: { id: MessagingChannel; key: string }[] = [
  { id: "sms", key: "channel_pref_sms" },
  { id: "whatsapp", key: "channel_pref_whatsapp" },
  { id: "email", key: "channel_pref_email" },
  { id: "none", key: "channel_pref_none" },
];

export default function ChannelPicker({ value, onChange, emailAvailable }: Props) {
  const t = useTranslations("admin_intake");
  return (
    <div className="mt-3">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">
        {t("channel_pref_label")}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => {
          const disabled = c.id === "email" && !emailAvailable;
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm transition ${
                disabled
                  ? "bg-mute-100 text-mute-300 cursor-not-allowed"
                  : active
                    ? "bg-ink text-bone"
                    : "bg-mute-100 text-mute-600 hover:bg-mute-200"
              }`}
              title={disabled ? t("channel_pref_email_disabled_hint") : undefined}
            >
              {t(c.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `CustomerBlock`**

Open `components/admin/intake/CustomerBlock.tsx`. Add to the `CustomerSnapshot` type:

```ts
export type CustomerSnapshot = {
  name: string;
  phone: string;
  email: string;
  messagingChannel: MessagingChannel;  // NEW
};
```

Import `MessagingChannel` and `ChannelPicker`:

```ts
import type { MessagingChannel } from "@/types/order";
import ChannelPicker from "./ChannelPicker";
```

When the customer lookup hydrates the snapshot (in the recurring-customer branch), include the existing `messagingChannel`:

```ts
onChange({
  ...value,
  name: value.name || c.name,
  email: value.email || c.email || "",
  messagingChannel: value.messagingChannel === "sms" && c.messagingChannel ? c.messagingChannel : value.messagingChannel,
});
```

Render the picker after the email input:

```tsx
<ChannelPicker
  value={value.messagingChannel}
  onChange={(v) => onChange({ ...value, messagingChannel: v })}
  emailAvailable={value.email.trim().length > 0}
/>
```

- [ ] **Step 4: Update IntakeForm initial state**

Open `components/admin/intake/IntakeForm.tsx` and change the customer default:

```ts
const [customer, setCustomer] = useState<CustomerSnapshot>({
  name: "",
  phone: "",
  email: "",
  messagingChannel: "sms",
});
```

In the reset after submit, include the new field too.

- [ ] **Step 5: Verify build + test**

Run: `pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: zero tsc errors; full suite passes; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/admin/intake/ChannelPicker.tsx components/admin/intake/CustomerBlock.tsx components/admin/intake/IntakeForm.tsx messages/en.json messages/es.json
git commit -m "feat(intake): channel picker in customer block"
```

---

### Task 13: IntakeForm submit + locale + status banner

**Files:**
- Modify: `components/admin/intake/IntakeForm.tsx`
- Modify: `messages/en.json`, `messages/es.json` (banner strings)

- [ ] **Step 1: i18n banner strings**

Append to `admin_intake` in both message files:

**EN:**
```json
"banner_saved": "Order {orderId} saved · ticket queued",
"banner_message_sent": "{channel} sent to {phone}",
"banner_message_skipped": "{channel} not sent ({reason})",
"banner_message_failed": "{channel} to {phone} failed",
"banner_retry": "Retry",
"banner_dismiss": "Dismiss"
```

**ES:** same keys, translated:
```json
"banner_saved": "Pedido {orderId} guardado · ticket en cola",
"banner_message_sent": "{channel} enviado a {phone}",
"banner_message_skipped": "{channel} no enviado ({reason})",
"banner_message_failed": "{channel} a {phone} falló",
"banner_retry": "Reintentar",
"banner_dismiss": "Cerrar"
```

- [ ] **Step 2: Pass `messagingChannel` + `locale` on submit**

In `IntakeForm.tsx`'s `onSubmit`, modify the body:

```ts
const body = {
  source: channel,
  customer: {
    phone: customer.phone,
    name: customer.name,
    email: customer.email || undefined,
    messagingChannel: customer.messagingChannel,
    locale,  // pass the active form locale; backend persists on customer
  },
  fulfillment: toOrderFulfillment(fulfillment),
  lines,
  totalsOverride: override,
  payment,
};
```

- [ ] **Step 3: Implement the post-save banner**

Read `useSearchParams()` and show a small banner above the form when `?ok=do_...` is present. Add at the top of the component:

```tsx
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// ...inside IntakeForm
const searchParams = useSearchParams();
const okOrderId = searchParams.get("ok");
const [banner, setBanner] = useState<{ orderId: string; channel?: string; phone?: string; status?: string; reason?: string } | null>(null);

useEffect(() => {
  if (!okOrderId) return;
  setBanner({ orderId: okOrderId });
  // Fetch the latest message for this order so we can show what was sent
  fetch(`/api/admin/orders/${encodeURIComponent(okOrderId)}/last-message`)
    .then((r) => r.ok ? r.json() : null)
    .then((m) => {
      if (!m) return;
      setBanner((b) => b ? { ...b, channel: m.channel, phone: m.toPhone, status: m.status, reason: m.error } : null);
    })
    .catch(() => {});
}, [okOrderId]);

async function retrySend() {
  if (!banner) return;
  await fetch(`/api/admin/orders/${encodeURIComponent(banner.orderId)}/payment-link`, { method: "POST" });
  // refresh banner
  router.replace(`/${locale}/admin/intake?ok=${encodeURIComponent(banner.orderId)}`);
}
```

Render inside `<main>` just below the `<h1>`:

```tsx
{banner && (
  <div className="mb-4 px-5 py-3 rounded-2xl bg-bone border border-mute-200 flex items-center justify-between gap-3 text-sm">
    <div>
      <span className="font-medium">{t("banner_saved", { orderId: banner.orderId })}</span>
      {banner.channel && banner.status === "sent" && (
        <span className="text-mute-600"> · {t("banner_message_sent", { channel: banner.channel.toUpperCase(), phone: banner.phone ?? "" })}</span>
      )}
      {banner.status === "skipped" && (
        <span className="text-mute-600"> · {t("banner_message_skipped", { channel: (banner.channel ?? "").toUpperCase(), reason: banner.reason ?? "" })}</span>
      )}
      {banner.status === "failed" && (
        <span className="text-error"> · {t("banner_message_failed", { channel: (banner.channel ?? "").toUpperCase(), phone: banner.phone ?? "" })}</span>
      )}
    </div>
    <div className="flex gap-2">
      {banner.status === "failed" && (
        <button type="button" onClick={retrySend} className="px-3 py-1.5 rounded-full bg-ink text-bone text-xs">{t("banner_retry")}</button>
      )}
      <button type="button" onClick={() => setBanner(null)} className="px-3 py-1.5 rounded-full border border-mute-200 text-mute-600 text-xs">{t("banner_dismiss")}</button>
    </div>
  </div>
)}
```

This references a new endpoint `GET /api/admin/orders/[id]/last-message`. Add it:

Create `app/api/admin/orders/[id]/last-message/route.ts`:

```ts
import { NextResponse } from "next/server";
import { recentMessagesForOrder } from "@/lib/message-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = recentMessagesForOrder(id, 1);
  if (rows.length === 0) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, ...rows[0] });
}
```

- [ ] **Step 4: Smoke test**

Manually verify in dev: create a pending order with `TWILIO_DRY_RUN=true`, observe the dry-run log line, and confirm the banner shows "SMS sent to +1...". Then with `TWILIO_SMS_ENABLED=false`, confirm the banner shows "SMS not sent (sms_disabled)".

- [ ] **Step 5: Test all + commit**

```bash
pnpm tsc --noEmit && pnpm test && pnpm build
git add components/admin/intake/IntakeForm.tsx app/api/admin/orders/\[id\]/last-message/route.ts messages/en.json messages/es.json
git commit -m "feat(intake): post-save banner with message status + retry"
```

---

## After this plan

Wire the operational steps (Maky-facing):

1. Create Twilio account → get `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Put in production env.
2. Set `TWILIO_SMS_ENABLED=true`, keep `TWILIO_WHATSAPP_ENABLED=false`, `TWILIO_DRY_RUN=false`.
3. Submit a test pending order on the iPad. Confirm SMS lands on a real phone with the right copy + Stripe link.
4. Apply for WhatsApp Business via Meta. Submit the 6 templates (copy-paste from this plan's Task 6 + spec).
5. Once Meta approves and Twilio surfaces the Content SIDs, populate `TWILIO_TEMPLATE_*` env vars.
6. Set `TWILIO_WHATSAPP_ENABLED=true`. Test on a real WhatsApp customer.

Phase 3 (dashboard, day-of operations) starts when this is stable in production for a week.
