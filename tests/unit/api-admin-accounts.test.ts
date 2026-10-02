import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { createAccount, updateAccount } from "@/lib/house-account-storage";
import { recordCharge } from "@/lib/house-account-ledger";
import { enqueue, getSend } from "@/lib/house-account-sends";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ data: { id: "em" }, error: null }) }; } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T14:00:00Z"));
  sendSms.mockReset(); sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => { closeDb(); vi.useRealTimers(); vi.unstubAllEnvs(); });

const cookie = () => ({ cookie: `intake_session=${signSession()}` });
function req(url: string, method = "GET", body?: unknown, authed = true) {
  return new Request(`http://x${url}`, {
    method,
    headers: { "content-type": "application/json", ...(authed ? cookie() : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const params = (p: Record<string, string>): any => ({ params: Promise.resolve(p) });

function seedOrder(id: string, accountId: string, total: number) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone, fulfillment_method, window_date,
       lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents, fulfillment_status,
       payment_status, payment_method, house_account_id, order_number, created_at, updated_at)
     VALUES (?, 'es', 'phone', 'Dest', '555', '5165550100', 'delivery', '2026-10-01', '[]', ?, 0, 0, ?, 0, 'pending',
       'pending', 'house-account', ?, 1001, '2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z')`,
  ).run(id, total, total, accountId);
}
function seedCustomer(id: string, phone: string) {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES (?, 'Ana', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run(id, phone);
}
function chargedAccount(name = "Hotel", phone = "5165550100") {
  const a = createAccount({ name, billingPhone: phone, cadence: "monthly", issueDay: 1, termsDays: 15, statementChannel: "sms" }, "2026-09-01");
  getDb().prepare("UPDATE house_accounts SET created_at = '2026-09-01T12:00:00Z' WHERE id = ?").run(a.id);
  seedOrder(`o_${a.id}`, a.id, 7000);
  const e = recordCharge({ accountId: a.id, orderId: `o_${a.id}`, amountCents: 7000, actor: "m" });
  getDb().prepare("UPDATE house_account_entries SET created_at = '2026-09-10T12:00:00Z' WHERE id = ?").run(e.id);
  return a;
}

describe("accounts collection", () => {
  it("POST creates, 400 on an empty name; GET lists with upcoming sends", async () => {
    const { POST, GET } = await import("@/app/api/admin/accounts/route");
    expect((await POST(req("/api/admin/accounts", "POST", { name: " " }))).status).toBe(400);
    const res = await POST(req("/api/admin/accounts", "POST", { name: "Hotel", billingPhone: "(516) 555-0100", billingEmail: "" }));
    expect(res.status).toBe(201);
    const { account } = await res.json();
    expect(account.billingPhone).toBe("5165550100");
    expect(account.billingEmail).toBeUndefined();
    const list = await (await GET(req("/api/admin/accounts?filter=all"))).json();
    expect(list.accounts.map((a: { name: string }) => a.name)).toEqual(["Hotel"]);
    expect(list.upcoming).toEqual([]);
  });
  it("search and for-phone", async () => {
    const a = createAccount({ name: "Iglesia San José" });
    seedCustomer("cus_1", "5165550111");
    const { linkContact } = await import("@/lib/house-account-storage");
    linkContact(a.id, "cus_1");
    const { GET: search } = await import("@/app/api/admin/accounts/search/route");
    expect(await (await search(req("/api/admin/accounts/search?q=igle"))).json()).toEqual({ accounts: [{ id: a.id, name: "Iglesia San José" }] });
    const { GET: forPhone } = await import("@/app/api/admin/accounts/for-phone/route");
    expect(await (await forPhone(req("/api/admin/accounts/for-phone?phone=516-555-0111"))).json()).toEqual({ account: { id: a.id, name: "Iglesia San José" } });
    expect(await (await forPhone(req("/api/admin/accounts/for-phone?phone=5165559999"))).json()).toEqual({ account: null });
  });
});

describe("account detail", () => {
  it("GET returns the detail with running balances; 404 unknown", async () => {
    const a = chargedAccount();
    const { GET } = await import("@/app/api/admin/accounts/[id]/route");
    expect((await GET(req("/x"), params({ id: "ha_nope" }))).status).toBe(404);
    const d = await (await GET(req("/x"), params({ id: a.id }))).json();
    expect(d.balanceCents).toBe(7000);
    expect(d.entries[0].runningCents).toBe(7000);
    expect(d.statements).toEqual([]);
    expect(d.contacts).toEqual([]);
  });
  it("PATCH edits the plan and reactivation skips stale sends", async () => {
    const a = chargedAccount();
    const { PATCH } = await import("@/app/api/admin/accounts/[id]/route");
    const r = await PATCH(req("/x", "PATCH", { termsDays: 30, reminderPlan: [{ offsetDays: 0, channel: "sms" }], status: "paused" }), params({ id: a.id }));
    expect(r.status).toBe(200);
    expect((await r.json()).account).toMatchObject({ termsDays: 30, status: "paused", reminderPlan: [{ offsetDays: 0, channel: "sms" }] });
    getDb().prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
    ).run(a.id);
    const [stale, future] = enqueue([
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-09-29" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-20" },
    ]);
    await PATCH(req("/x", "PATCH", { status: "active" }), params({ id: a.id }));
    expect(getSend(stale.id)?.status).toBe("skipped");
    expect(getSend(future.id)?.status).toBe("scheduled");
    expect((await PATCH(req("/x", "PATCH", { issueDay: 31 }), params({ id: a.id }))).status).toBe(400);
  });
});

describe("money routes need the admin session", () => {
  it("payments: 401 without session, 200 with", async () => {
    const a = chargedAccount();
    const { POST } = await import("@/app/api/admin/accounts/[id]/payments/route");
    expect((await POST(req("/x", "POST", { amountCents: 100, method: "cash" }, false), params({ id: a.id }))).status).toBe(401);
    const res = await POST(req("/x", "POST", { amountCents: 7000, method: "zelle", note: "transfer 123" }), params({ id: a.id }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.entry).toMatchObject({ kind: "payment", amountCents: -7000, method: "zelle" });
    expect(d.allocations).toEqual([{ id: `o_${a.id}`, appliedCents: 7000 }]);
    expect(d.detail.balanceCents).toBe(0);
    expect((await POST(req("/x", "POST", { amountCents: 0, method: "cash" }), params({ id: a.id }))).status).toBe(400);
    expect((await POST(req("/x", "POST", { amountCents: 5, method: "cash" }), params({ id: "ha_nope" }))).status).toBe(404);
  });
  it("entries: credit allocates, adjustment is signed", async () => {
    const a = chargedAccount();
    const { POST } = await import("@/app/api/admin/accounts/[id]/entries/route");
    const c = await (await POST(req("/x", "POST", { kind: "credit", amountCents: 500, note: "cortesía" }), params({ id: a.id }))).json();
    expect(c.entry).toMatchObject({ kind: "credit", amountCents: -500 });
    const adj = await (await POST(req("/x", "POST", { kind: "adjustment", amountCents: -200, note: "descuento" }), params({ id: a.id }))).json();
    expect(adj.entry).toMatchObject({ kind: "adjustment", amountCents: -200 });
    expect(adj.detail.balanceCents).toBe(6300);
    expect((await POST(req("/x", "POST", { kind: "adjustment", amountCents: 0, note: "x" }), params({ id: a.id }))).status).toBe(400);
  });
});

describe("contacts", () => {
  it("link, conflict, unlink", async () => {
    const a = createAccount({ name: "A" });
    const b = createAccount({ name: "B" });
    seedCustomer("cus_1", "5165550111");
    const { POST, DELETE } = await import("@/app/api/admin/accounts/[id]/contacts/route");
    const ok = await POST(req("/x", "POST", { customerId: "cus_1" }), params({ id: a.id }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).contacts.map((c: { id: string }) => c.id)).toEqual(["cus_1"]);
    expect((await POST(req("/x", "POST", { customerId: "cus_1" }), params({ id: b.id }))).status).toBe(409);
    expect((await POST(req("/x", "POST", { customerId: "cus_404" }), params({ id: a.id }))).status).toBe(404);
    const gone = await DELETE(req("/x", "DELETE", { customerId: "cus_1" }), params({ id: a.id }));
    expect((await gone.json()).contacts).toEqual([]);
  });
});

describe("statements and sends", () => {
  it("issue now, send now, void", async () => {
    const a = chargedAccount();
    const { POST: issue } = await import("@/app/api/admin/accounts/[id]/statements/route");
    const r = await issue(req("/x", "POST"), params({ id: a.id }));
    expect(r.status).toBe(201);
    const { statement } = await r.json();
    expect(statement).toMatchObject({ periodEnd: "2026-10-02", closingCents: 7000, status: "open" });
    expect((await (await issue(req("/x", "POST"), params({ id: a.id }))).json()).statement).toBeNull();

    const { POST: send } = await import("@/app/api/admin/accounts/statements/[sid]/send/route");
    const s = await send(req("/x", "POST", { channel: "sms" }), params({ sid: statement.id }));
    expect(s.status).toBe(200);
    expect((await s.json()).send).toMatchObject({ kind: "manual", status: "sent", smsSid: "SM1" });
    expect(sendSms).toHaveBeenCalledTimes(1);
    const noEmail = await send(req("/x", "POST", { channel: "email" }), params({ sid: statement.id }));
    expect(noEmail.status).toBe(422);
    expect(await noEmail.json()).toEqual({ error: "no_channel", reason: "sin email" });

    const { PATCH: voidRoute } = await import("@/app/api/admin/accounts/statements/[sid]/route");
    const v = await voidRoute(req("/x", "PATCH", { void: true }), params({ sid: statement.id }));
    expect((await v.json()).statement.status).toBe("void");
    expect((await voidRoute(req("/x", "PATCH", { void: true }), params({ sid: "nope" }))).status).toBe(404);
  });
  it("sends: skip, reschedule, sendNow, 409 when not scheduled", async () => {
    const a = chargedAccount();
    getDb().prepare(
      `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date, opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
       VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, 0, 'open', '[]', '2026-10-01T13:00:00Z')`,
    ).run(a.id);
    const [x, y, z] = enqueue([
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 1, channel: "sms", scheduledFor: "2026-10-16" },
      { accountId: a.id, statementId: "hst_1", kind: "reminder", stepIndex: 2, channel: "sms", scheduledFor: "2026-10-23" },
    ]);
    const { PATCH } = await import("@/app/api/admin/accounts/sends/[id]/route");
    expect((await (await PATCH(req("/x", "PATCH", { skip: true }), params({ id: x.id }))).json()).send.status).toBe("skipped");
    expect((await (await PATCH(req("/x", "PATCH", { scheduledFor: "2026-10-18" }), params({ id: y.id }))).json()).send.scheduledFor).toBe("2026-10-18");
    expect((await PATCH(req("/x", "PATCH", { scheduledFor: "2026-09-01" }), params({ id: y.id }))).status).toBe(400);
    const now = await (await PATCH(req("/x", "PATCH", { sendNow: true }), params({ id: z.id }))).json();
    expect(now.send).toMatchObject({ status: "sent", smsSid: "SM1" });
    expect((await PATCH(req("/x", "PATCH", { skip: true }), params({ id: z.id }))).status).toBe(409);
  });
});
