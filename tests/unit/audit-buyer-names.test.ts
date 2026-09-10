import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { audit, enrichFromStripe, formatReport, type Finding } from "@/scripts/audit-buyer-names";

// audit() opens its own READ-ONLY connection to a path, so this cannot use the
// ":memory:" database the other script tests share — it needs a real file.
let file: string;

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "diva-audit-")), "diva.sqlite");
  vi.stubEnv("SQLITE_FILE", file);
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

function seedOrder(o: {
  id: string;
  source: string;
  buyerName?: string | null;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  customerId?: string | null;
  orderNumber: number;
}) {
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone,
        contact_phone, contact_name, fulfillment_method, lines_json, subtotal_cents,
        delivery_cents, tax_cents, total_cents, fulfillment_status, payment_status,
        order_number, created_at, updated_at)
       VALUES (?, 'en', ?, ?, ?, ?, ?, ?, 'delivery', '[]', 10000, 0, 862, 10862,
        'delivered', 'paid', ?, '2026-09-08T14:00:00Z', '2026-09-08T14:00:00Z')`,
    )
    .run(o.id, o.source, o.customerId ?? null, o.recipientName, o.recipientPhone,
      o.buyerPhone, o.buyerName ?? null, o.orderNumber);
}

function seedCustomer(id: string, name: string, phone: string) {
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, 1, '2026-09-08T14:00:00Z', '2026-09-08T14:00:00Z')`,
    )
    .run(id, name, phone);
}

describe("audit-buyer-names", () => {
  it("flags a CRM record filed under the recipient's name, and recovers the real one", () => {
    // The reported case: Robyn paid, Michelle received, the CRM record on Robyn's
    // phone ended up named Michelle. A counter order taken at the till knows the
    // buyer's real name, so the audit can propose it.
    seedOrder({ id: "o1", source: "web", buyerPhone: "5165550001", recipientName: "Michelle Neumann",
      recipientPhone: "5165559999", customerId: "cus_robyn", orderNumber: 1194 });
    seedOrder({ id: "o2", source: "walk-in", buyerName: "Robyn Vega", buyerPhone: "5165550001",
      recipientName: "Michelle Neumann", recipientPhone: "5165559999", orderNumber: 1180 });
    seedCustomer("cus_robyn", "Michelle Neumann", "5165550001");

    const { findings } = audit(file);
    const bad = findings.filter((f) => f.verdict === "contaminado");
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({
      order: "#1194",
      crmNameNow: "Michelle Neumann",
      crmCustomerId: "cus_robyn",
      repairCandidate: "Robyn Vega",
    });
  });

  it("does not flag a buyer who sent flowers to their own phone", () => {
    seedOrder({ id: "o1", source: "web", buyerPhone: "5165550003", recipientName: "Dana Self",
      recipientPhone: "5165550003", customerId: "cus_self", orderNumber: 1190 });
    seedCustomer("cus_self", "Dana Self", "5165550003");

    const { findings } = audit(file);
    expect(findings.filter((f) => f.verdict === "contaminado")).toHaveLength(0);
    expect(findings.filter((f) => f.verdict === "probablemente-ok")).toHaveLength(1);
  });

  it("ignores orders that carry a real buyer name", () => {
    seedOrder({ id: "o1", source: "web", buyerName: "Pat Buyer", buyerPhone: "5165550005",
      recipientName: "Sam Recip", recipientPhone: "5165556666", customerId: "cus_ok", orderNumber: 1195 });
    seedCustomer("cus_ok", "Pat Buyer", "5165550005");

    const { findings, totals } = audit(file);
    expect(findings).toHaveLength(0);
    expect(totals.webSinNombreDeComprador).toBe(0);
  });

  it("reports a nameless order with no CRM record separately — nothing was persisted", () => {
    seedOrder({ id: "o1", source: "web", buyerPhone: "5165550004", recipientName: "Nora Gift",
      recipientPhone: "5165557777", orderNumber: 1191 });

    const { findings } = audit(file);
    expect(findings).toHaveLength(1);
    expect(findings[0].verdict).toBe("sin-registro-crm");
  });
});

describe("enrichFromStripe", () => {
  // The card that paid carries the buyer's real name. Stripe is the only place
  // that name survived for orders whose checkout never asked for one, so this is
  // what turns the audit from "ask them" into "we already know".
  const contaminado = (over: Partial<Finding> = {}): Finding => ({
    verdict: "contaminado",
    order: "#1194",
    date: "2026-09-08",
    total: "$151.21",
    buyerPhone: "5165550001",
    recipientName: "Michelle Neumann",
    recipientPhone: "5165559999",
    crmCustomerId: "cus_robyn",
    crmNameNow: "Michelle Neumann",
    paymentIntentId: "pi_123",
    ...over,
  });

  it("puts the cardholder name on a contaminated finding", async () => {
    const lookup = vi.fn().mockResolvedValue("Robyn Vega");
    const [f] = await enrichFromStripe([contaminado()], lookup);
    expect(f.stripeName).toBe("Robyn Vega");
    expect(lookup).toHaveBeenCalledWith({ paymentIntentId: "pi_123", checkoutSessionId: undefined });
  });

  it("only spends calls on findings worth repairing", async () => {
    const lookup = vi.fn().mockResolvedValue("Someone");
    await enrichFromStripe(
      [
        contaminado(),
        { ...contaminado(), verdict: "probablemente-ok" },
        { ...contaminado(), verdict: "sin-registro-crm" },
      ],
      lookup,
    );
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("skips a finding with no Stripe reference at all", async () => {
    const lookup = vi.fn();
    const [f] = await enrichFromStripe(
      [contaminado({ paymentIntentId: undefined, checkoutSessionId: undefined })],
      lookup,
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(f.stripeName).toBeUndefined();
  });

  it("records a lookup failure without losing the rest of the report", async () => {
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new Error("No such payment_intent"))
      .mockResolvedValueOnce("Dana Gil");
    const out = await enrichFromStripe(
      [contaminado(), contaminado({ order: "#1188", paymentIntentId: "pi_456" })],
      lookup,
    );
    expect(out[0].stripeError).toContain("No such payment_intent");
    expect(out[0].stripeName).toBeUndefined();
    expect(out[1].stripeName).toBe("Dana Gil");
  });

  it("notes when the card name matches what the CRM already has", async () => {
    // Not a gift after all, or the recipient paid with their own card: nothing
    // to correct, and the report should not tell the shop to change it.
    const lookup = vi.fn().mockResolvedValue("Michelle Neumann");
    const [f] = await enrichFromStripe([contaminado()], lookup);
    expect(f.stripeName).toBe("Michelle Neumann");
    expect(f.stripeConfirmsCrm).toBe(true);
  });
});

describe("formatReport", () => {
  const totals = { ordenes: 2, ordenesWeb: 2, webSinNombreDeComprador: 1, registrosCrm: 1 };
  const base: Finding = {
    verdict: "contaminado",
    order: "#1194",
    date: "2026-09-08",
    total: "$151.21",
    buyerPhone: "5165550001",
    recipientName: "Michelle Neumann",
    recipientPhone: "5165559999",
    crmCustomerId: "cus_robyn",
    crmNameNow: "Michelle Neumann",
  };

  it("leads with the cardholder name when Stripe found one", () => {
    const text = formatReport({
      file: "x.sqlite", totals, useStripe: true,
      findings: [{ ...base, stripeName: "Robyn Vega", stripeConfirmsCrm: false }],
    });
    expect(text).toContain('NOMBRE REAL ...... "Robyn Vega"');
    expect(text).toContain("Nombres recuperados de Stripe ..... 1 de 1");
  });

  it("tells the shop NOT to change a record Stripe agrees with", () => {
    const text = formatReport({
      file: "x.sqlite", totals, useStripe: true,
      findings: [{ ...base, stripeName: "Michelle Neumann", stripeConfirmsCrm: true }],
    });
    expect(text).toContain("NO lo cambies");
    expect(text).not.toContain("NOMBRE REAL");
    expect(text).toContain("Nombres recuperados de Stripe ..... 0 de 1");
  });

  it("suggests --stripe when it was not used and no name is known", () => {
    const text = formatReport({ file: "x.sqlite", totals, useStripe: false, findings: [base] });
    expect(text).toContain("prueba con --stripe");
  });

  it("says the offline report still stands when Stripe could not be reached", () => {
    const text = formatReport({
      file: "x.sqlite", totals, useStripe: true, stripeFailed: "STRIPE_SECRET_KEY no está definida",
      findings: [base],
    });
    expect(text).toContain("Stripe no respondió: STRIPE_SECRET_KEY no está definida");
    expect(text).toContain("Sigo con el reporte offline.");
    expect(text).toContain("Orden #1194");
  });
});
