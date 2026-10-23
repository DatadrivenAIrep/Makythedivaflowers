// Pure rules for sales-tax exemption. Client-safe: used by the intake UI and
// by the server, so both decide identically.
import type {
  DefaultExemption, ExemptionStatus, TaxExemption, TaxExemptRequest,
} from "@/types/tax-exempt";

export const TAX_EXEMPT_CERT_REQUIRED = "tax_exempt_cert_required" as const;

export function exemptionStatus(e: TaxExemption | null | undefined, today: string): ExemptionStatus {
  if (!e || !e.exempt) return "none";
  if (!e.cert || !e.cert.trim()) return "missing_cert";
  if (e.expires && e.expires < today) return "expired";
  return "active";
}

export function isExemptionValid(e: TaxExemption | null | undefined, today: string): boolean {
  return exemptionStatus(e, today) === "active";
}

/** The account's certificate wins when the order is charged to it; else the buyer's. */
export function resolveDefaultExemption(args: {
  account?: TaxExemption | null;
  customer?: TaxExemption | null;
  today: string;
}): DefaultExemption | null {
  if (args.account && isExemptionValid(args.account, args.today)) {
    return { cert: args.account.cert!.trim(), source: "account" };
  }
  if (args.customer && isExemptionValid(args.customer, args.today)) {
    return { cert: args.customer.cert!.trim(), source: "customer" };
  }
  return null;
}

export type OrderExemptionResult =
  | { ok: true; exemption: { cert: string } | null }
  | { ok: false; error: typeof TAX_EXEMPT_CERT_REQUIRED };

export function resolveOrderExemption(args: {
  fallback: { cert: string } | null;
  requested?: TaxExemptRequest;
}): OrderExemptionResult {
  const { fallback, requested } = args;
  if (!requested) return { ok: true, exemption: fallback ? { cert: fallback.cert } : null };
  if (!requested.taxExempt) return { ok: true, exemption: null };
  const cert = requested.cert?.trim() || fallback?.cert;
  if (!cert) return { ok: false, error: TAX_EXEMPT_CERT_REQUIRED };
  return { ok: true, exemption: { cert } };
}

/** Whether the per-order toggle is on: an explicit choice, else the default. */
export function isRequestExempt(fallback: { cert: string } | null, requested?: TaxExemptRequest): boolean {
  return requested ? requested.taxExempt : fallback !== null;
}

/** Clean an exemption being saved on a customer/account. */
export function normalizeExemptionInput(e: {
  exempt: boolean;
  cert?: string | null;
  expires?: string | null;
}): TaxExemption {
  const cert = e.cert?.trim() || null;
  const expires = e.expires?.trim() || null;
  if (e.exempt && !cert) throw new Error(TAX_EXEMPT_CERT_REQUIRED);
  return { exempt: e.exempt, cert, expires };
}
