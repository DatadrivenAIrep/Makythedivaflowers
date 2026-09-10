/**
 * Read-only audit: web orders whose buyer never gave a name, and the CRM records
 * that were consequently filed under the RECIPIENT's name.
 *
 * Until `fix(checkout): ask who is buying`, web checkout collected no buyer name,
 * and `buyerName()` in on-web-order-paid fell back to the recipient's. The order
 * row kept a blank contact_name, but the customers row — keyed by the BUYER's
 * phone — was created carrying the recipient's name. That record is what every
 * later order and every intake lookup on that number reads back.
 *
 * This script only reads. It opens the database read-only, so it cannot write
 * even if something here is wrong. Repair is a human decision, made in the admin.
 *
 * Usage:
 *   SQLITE_FILE=/path/to/diva.sqlite npx tsx --tsconfig scripts/tsconfig.json scripts/audit-buyer-names.ts
 *   ... --json    machine-readable output
 */
import path from "node:path";

// node:sqlite is reached through process.getBuiltinModule for the same reason
// lib/db.ts does it: bundlers cannot statically analyse the call, so the builtin
// stays out of the bundle and is resolved at runtime. Declared with the options
// argument, which this script uses to open the database READ-ONLY.
type ReadOnlyDb = {
  prepare(sql: string): { all(...params: unknown[]): unknown[] };
  close(): void;
};
type SqliteModule = {
  DatabaseSync: new (file: string, options?: { readOnly?: boolean }) => ReadOnlyDb;
};

function openReadOnly(file: string): ReadOnlyDb {
  const p = process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown };
  const mod =
    typeof p.getBuiltinModule === "function"
      ? (p.getBuiltinModule("node:sqlite") as SqliteModule | undefined)
      : undefined;
  const sqlite =
    mod && mod.DatabaseSync
      ? mod
      : ((0, eval)("require") as NodeRequire)(["node", "sqlite"].join(":")) as SqliteModule;
  return new sqlite.DatabaseSync(file, { readOnly: true });
}

type OrderRow = {
  id: string;
  order_number: number | null;
  source: string;
  created_at: string;
  contact_name: string | null;
  contact_phone: string;
  recipient_name: string;
  recipient_phone: string;
  customer_id: string | null;
  total_cents: number;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  order_count: number;
  first_seen_at: string;
};

const digits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");
const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();
const money = (c: number): string => `$${(c / 100).toFixed(2)}`;
const ref = (o: OrderRow): string => (o.order_number != null ? `#${o.order_number}` : o.id);

export type Finding = {
  verdict: "contaminado" | "probablemente-ok" | "sin-registro-crm";
  order: string;
  date: string;
  total: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string;
  crmCustomerId?: string;
  crmNameNow?: string;
  /** A real name for this phone found on another order (usually one taken by
   *  staff at the intake, where the name was always asked for). */
  repairCandidate?: string;
};

export function audit(file: string) {
  const db = openReadOnly(file);
  const orders = db.prepare(`SELECT id, order_number, source, created_at, contact_name,
    contact_phone, recipient_name, recipient_phone, customer_id, total_cents
    FROM orders ORDER BY created_at ASC`).all() as unknown as OrderRow[];
  const customers = db.prepare(
    `SELECT id, name, phone, order_count, first_seen_at FROM customers`,
  ).all() as unknown as CustomerRow[];
  db.close();

  const byId = new Map(customers.map((c) => [c.id, c]));
  const byPhone = new Map(customers.map((c) => [digits(c.phone), c]));

  // A phone that appears on ANY order with a real buyer name gives us the name
  // that record should have carried.
  const knownNames = new Map<string, string>();
  for (const o of orders) {
    const n = o.contact_name?.trim();
    if (n) knownNames.set(digits(o.contact_phone), n);
  }

  const web = orders.filter((o) => o.source === "web");
  const nameless = web.filter((o) => !o.contact_name || !o.contact_name.trim());

  const findings: Finding[] = [];
  for (const o of nameless) {
    const customer = (o.customer_id ? byId.get(o.customer_id) : undefined) ?? byPhone.get(digits(o.contact_phone));
    const base = {
      order: ref(o),
      date: o.created_at.slice(0, 10),
      total: money(o.total_cents),
      buyerPhone: o.contact_phone,
      recipientName: o.recipient_name,
      recipientPhone: o.recipient_phone,
    };
    if (!customer) {
      // The SMS still greeted the wrong name, but nothing was persisted.
      findings.push({ ...base, verdict: "sin-registro-crm" });
      continue;
    }
    const tookRecipientName = norm(customer.name) === norm(o.recipient_name);
    if (!tookRecipientName) continue; // record has some other, presumably real, name
    // Same phone for buyer and recipient = they sent to themselves; the name fits.
    const gift = digits(o.contact_phone) !== digits(o.recipient_phone);
    findings.push({
      ...base,
      verdict: gift ? "contaminado" : "probablemente-ok",
      crmCustomerId: customer.id,
      crmNameNow: customer.name,
      repairCandidate: knownNames.get(digits(o.contact_phone)),
    });
  }

  return {
    totals: {
      ordenes: orders.length,
      ordenesWeb: web.length,
      webSinNombreDeComprador: nameless.length,
      registrosCrm: customers.length,
    },
    findings,
  };
}

function main(): void {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  const report = audit(file);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ file, ...report }, null, 2));
    return;
  }

  const { totals, findings } = report;
  const bad = findings.filter((f) => f.verdict === "contaminado");
  const maybe = findings.filter((f) => f.verdict === "probablemente-ok");
  const orphan = findings.filter((f) => f.verdict === "sin-registro-crm");

  console.log(`\nBase de datos: ${file}  (solo lectura)\n`);
  console.log(`  Órdenes totales ................... ${totals.ordenes}`);
  console.log(`  Órdenes web ....................... ${totals.ordenesWeb}`);
  console.log(`  Web sin nombre de comprador ....... ${totals.webSinNombreDeComprador}`);
  console.log(`  Registros en CRM .................. ${totals.registrosCrm}\n`);

  if (bad.length) {
    console.log(`CONTAMINADOS — el CRM tiene el nombre del destinatario bajo el teléfono del comprador (${bad.length}):\n`);
    for (const f of bad) {
      console.log(`  Orden ${f.order}  ${f.date}  ${f.total}`);
      console.log(`    CRM dice ......... "${f.crmNameNow}"  (tel ${f.buyerPhone} — es del COMPRADOR)`);
      console.log(`    pero ese nombre es del destinatario, que está en el tel ${f.recipientPhone}`);
      console.log(`    nombre real ...... ${f.repairCandidate ? `"${f.repairCandidate}" (visto en otra orden del mismo teléfono)` : "no lo tenemos — hay que preguntarle"}`);
      console.log(`    registro CRM ..... ${f.crmCustomerId}\n`);
    }
  } else {
    console.log("CONTAMINADOS: ninguno.\n");
  }

  if (maybe.length) {
    console.log(`Probablemente OK (${maybe.length}) — el CRM tomó el nombre del destinatario, pero comprador y destinatario comparten teléfono, así que se lo mandó a sí mismo:`);
    for (const f of maybe) console.log(`  ${f.order}  ${f.date}  "${f.crmNameNow}"  tel ${f.buyerPhone}`);
    console.log("");
  }

  if (orphan.length) {
    console.log(`Sin registro en CRM (${orphan.length}) — el SMS saludó con el nombre equivocado, pero no quedó nada guardado:`);
    for (const f of orphan) console.log(`  ${f.order}  ${f.date}  destinatario "${f.recipientName}"  tel comprador ${f.buyerPhone}`);
    console.log("");
  }

  console.log("Nada fue modificado. La corrección se hace a mano desde el admin.\n");
}

if (process.argv[1] && process.argv[1].includes("audit-buyer-names")) main();
