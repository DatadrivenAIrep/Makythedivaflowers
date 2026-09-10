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
 *   SQLITE_FILE=/path/to/diva.sqlite pnpm audit:buyer-names
 *   ... --stripe  also ask Stripe for the name on the card that paid — the only
 *                 place the buyer's real name survived for these orders. Needs
 *                 STRIPE_SECRET_KEY; read-only retrievals.
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
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
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
  paymentIntentId?: string;
  checkoutSessionId?: string;
  /** Name on the card that paid, from Stripe. Only filled by --stripe. */
  stripeName?: string;
  /** Stripe agrees with the name already on the CRM row, so there is nothing to
   *  correct — the recipient paid with their own card, or it was not a gift. */
  stripeConfirmsCrm?: boolean;
  stripeError?: string;
};

export function audit(file: string) {
  const db = openReadOnly(file);
  const orders = db.prepare(`SELECT id, order_number, source, created_at, contact_name,
    contact_phone, recipient_name, recipient_phone, customer_id, total_cents,
    stripe_payment_intent_id, stripe_checkout_session_id
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
      paymentIntentId: o.stripe_payment_intent_id ?? undefined,
      checkoutSessionId: o.stripe_checkout_session_id ?? undefined,
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

/** Asks Stripe for the name on whatever paid. Injected so the enrichment can be
 *  tested without a network or a key. */
export type StripeLookup = (ref: {
  paymentIntentId?: string;
  checkoutSessionId?: string;
}) => Promise<string | null>;

/**
 * Fills in the buyer's real name from the card that paid.
 *
 * For an order whose checkout never asked who was buying, Stripe is the only
 * place the name survived: the cardholder is the person who paid, which is
 * exactly the person the CRM row should be named after. Strong evidence, not
 * proof — someone can pay with a spouse's card — so the report presents it for
 * a human to accept, and nothing is written.
 *
 * Only "contaminado" findings are looked up: the others have either nothing to
 * repair or no record to repair. Failures are recorded per finding so one dead
 * payment intent cannot sink the run.
 */
export async function enrichFromStripe(
  findings: Finding[],
  lookup: StripeLookup,
): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const f of findings) {
    const worthAsking =
      f.verdict === "contaminado" && (f.paymentIntentId || f.checkoutSessionId);
    if (!worthAsking) {
      out.push(f);
      continue;
    }
    try {
      const name = await lookup({
        paymentIntentId: f.paymentIntentId,
        checkoutSessionId: f.checkoutSessionId,
      });
      const clean = name?.trim();
      out.push(
        clean
          ? { ...f, stripeName: clean, stripeConfirmsCrm: norm(clean) === norm(f.crmNameNow) }
          : f,
      );
    } catch (e) {
      out.push({ ...f, stripeError: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** The real lookup. Built lazily: the plain offline audit must run with no
 *  Stripe key present, and lib/stripe-server throws at import when it is unset. */
export async function makeStripeLookup(): Promise<StripeLookup> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está definida — no puedo consultar Stripe.");
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(key, { typescript: true });

  return async ({ paymentIntentId, checkoutSessionId }) => {
    if (paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge", "payment_method"],
      });
      const charge = pi.latest_charge;
      if (charge && typeof charge !== "string" && charge.billing_details?.name) {
        return charge.billing_details.name;
      }
      const pm = pi.payment_method;
      if (pm && typeof pm !== "string" && pm.billing_details?.name) {
        return pm.billing_details.name;
      }
      return null;
    }
    if (checkoutSessionId) {
      const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      return cs.customer_details?.name ?? null;
    }
    return null;
  };
}

export type ReportInput = {
  file: string;
  totals: ReturnType<typeof audit>["totals"];
  findings: Finding[];
  useStripe: boolean;
  stripeFailed?: string | null;
};

/** The report as text. Split out from main() because this is the deliverable —
 *  the shop reads it to decide which records to retype by hand. */
export function formatReport({ file, totals, findings, useStripe, stripeFailed }: ReportInput): string {
  const bad = findings.filter((f) => f.verdict === "contaminado");
  const maybe = findings.filter((f) => f.verdict === "probablemente-ok");
  const orphan = findings.filter((f) => f.verdict === "sin-registro-crm");
  const out: string[] = [];
  const say = (line = "") => out.push(line);

  say();
  say(`Base de datos: ${file}  (solo lectura)`);
  say();
  say(`  Órdenes totales ................... ${totals.ordenes}`);
  say(`  Órdenes web ....................... ${totals.ordenesWeb}`);
  say(`  Web sin nombre de comprador ....... ${totals.webSinNombreDeComprador}`);
  say(`  Registros en CRM .................. ${totals.registrosCrm}`);
  if (useStripe && !stripeFailed) {
    const got = bad.filter((f) => f.stripeName && !f.stripeConfirmsCrm).length;
    say(`  Nombres recuperados de Stripe ..... ${got} de ${bad.length}`);
  }
  say();
  if (stripeFailed) {
    say(`Stripe no respondió: ${stripeFailed}`);
    say("Sigo con el reporte offline.");
    say();
  }

  if (bad.length) {
    say(`CONTAMINADOS — el CRM tiene el nombre del destinatario bajo el teléfono del comprador (${bad.length}):`);
    say();
    for (const f of bad) {
      say(`  Orden ${f.order}  ${f.date}  ${f.total}`);
      say(`    CRM dice ......... "${f.crmNameNow}"  (tel ${f.buyerPhone} — es del COMPRADOR)`);
      say(`    pero ese nombre es del destinatario, que está en el tel ${f.recipientPhone}`);
      if (f.stripeConfirmsCrm) {
        say(`    Stripe ........... la tarjeta dice lo mismo — pagó el destinatario, NO lo cambies`);
      } else if (f.stripeName) {
        say(`    NOMBRE REAL ...... "${f.stripeName}"  ← titular de la tarjeta que pagó (Stripe)`);
      } else if (f.stripeError) {
        say(`    Stripe ........... falló: ${f.stripeError}`);
      }
      if (f.repairCandidate) {
        say(`    otra orden ....... "${f.repairCandidate}" (mismo teléfono, nombre tomado por el equipo)`);
      }
      if (!f.stripeName && !f.repairCandidate) {
        say(`    nombre real ...... no lo tenemos${useStripe ? "" : " — prueba con --stripe"}, hay que preguntarle`);
      }
      say(`    registro CRM ..... ${f.crmCustomerId}`);
      say();
    }
    if (!useStripe) {
      say("Corre con --stripe para sacar el nombre del titular de la tarjeta que pagó.");
      say();
    }
  } else {
    say("CONTAMINADOS: ninguno.");
    say();
  }

  if (maybe.length) {
    say(`Probablemente OK (${maybe.length}) — el CRM tomó el nombre del destinatario, pero comprador y destinatario comparten teléfono, así que se lo mandó a sí mismo:`);
    for (const f of maybe) say(`  ${f.order}  ${f.date}  "${f.crmNameNow}"  tel ${f.buyerPhone}`);
    say();
  }

  if (orphan.length) {
    say(`Sin registro en CRM (${orphan.length}) — el SMS saludó con el nombre equivocado, pero no quedó nada guardado:`);
    for (const f of orphan) say(`  ${f.order}  ${f.date}  destinatario "${f.recipientName}"  tel comprador ${f.buyerPhone}`);
    say();
  }

  say("Nada fue modificado. La corrección se hace a mano desde el admin.");
  say();
  return out.join("\n");
}

async function main(): Promise<void> {
  const file = process.env.SQLITE_FILE ?? path.join(process.cwd(), "data", "diva.sqlite");
  const useStripe = process.argv.includes("--stripe");
  const report = audit(file);

  let findings = report.findings;
  let stripeFailed: string | null = null;
  if (useStripe) {
    try {
      findings = await enrichFromStripe(findings, await makeStripeLookup());
    } catch (e) {
      // A missing key or an unreachable Stripe must not cost the offline report.
      stripeFailed = e instanceof Error ? e.message : String(e);
    }
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ file, totals: report.totals, findings, stripeFailed }, null, 2));
    return;
  }
  console.log(formatReport({ file, totals: report.totals, findings, useStripe, stripeFailed }));
}

if (process.argv[1] && process.argv[1].includes("audit-buyer-names")) {
  void main();
}
