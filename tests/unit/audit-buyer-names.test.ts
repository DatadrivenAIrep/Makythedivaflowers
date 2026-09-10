import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { audit } from "@/scripts/audit-buyer-names";

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
