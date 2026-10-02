import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";

const create = vi.fn();
vi.mock("@/lib/stripe-server", () => ({ stripe: { checkout: { sessions: { create: (...a: unknown[]) => create(...a) } } } }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test");
  create.mockReset(); create.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/cs_1", expires_at: 1 });
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, status = "open", settled = 0) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId, settled, status);
}

describe("buildStatementCheckoutParams", () => {
  it("charges the remaining due, tags metadata, returns to the statement", async () => {
    const { buildStatementCheckoutParams } = await import("@/lib/house-statement-checkout");
    const a = createAccount({ name: "Hotel", billingEmail: "ap@hotel.com" });
    seedStatement(a.id, "open", 2000);
    const { getStatement } = await import("@/lib/house-account-statements");
    const p = buildStatementCheckoutParams(getStatement("hst_1")!, a);
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(5000);
    expect(p.metadata).toEqual({ kind: "house_statement", statementId: "hst_1", accountId: a.id });
    expect(p.payment_intent_data?.metadata).toEqual({ kind: "house_statement", statementId: "hst_1", accountId: a.id });
    expect(p.success_url).toBe("https://x.test/s/AbCdEfGh?paid=1");
    expect(p.cancel_url).toBe("https://x.test/s/AbCdEfGh");
    expect(p.customer_email).toBe("ap@hotel.com");
    expect(p.line_items?.[0].price_data?.product_data?.name).toContain("ST-1001");
  });
  it("throws when nothing is due", async () => {
    const { buildStatementCheckoutParams } = await import("@/lib/house-statement-checkout");
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "open", 7000);
    const { getStatement } = await import("@/lib/house-account-statements");
    expect(() => buildStatementCheckoutParams(getStatement("hst_1")!, a)).toThrow("nothing_due");
  });
});

describe("POST /s/[code]/pay", () => {
  const post = async (code: string) => {
    const { POST } = await import("@/app/s/[code]/pay/route");
    return POST(new Request(`http://x/s/${code}/pay`, { method: "POST" }), { params: Promise.resolve({ code }) });
  };
  it("303 to the Stripe session", async () => {
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id);
    const res = await post("AbCdEfGh");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/cs_1");
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("404 unknown, 409 when paid, 410 when void", async () => {
    expect((await post("AbCdEfGh")).status).toBe(404);
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "paid", 7000);
    expect((await post("AbCdEfGh")).status).toBe(409);
    getDb().prepare("UPDATE house_account_statements SET status = 'void' WHERE id = 'hst_1'").run();
    expect((await post("AbCdEfGh")).status).toBe(410);
    expect(create).not.toHaveBeenCalled();
  });
});
