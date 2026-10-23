/** Sales-tax exemption on file for a customer or a house account. */
export type TaxExemption = {
  exempt: boolean;
  /** NY exemption certificate number (ST-119.1 / ST-120). Required while exempt. */
  cert: string | null;
  /** YYYY-MM-DD; null = no expiry. Valid through this day inclusive. */
  expires: string | null;
};

export const NO_EXEMPTION: TaxExemption = { exempt: false, cert: null, expires: null };

export type ExemptionSource = "account" | "customer" | "order";
export type DefaultExemption = { cert: string; source: ExemptionSource };
/** What staff asked for on one order. Absent = follow the default. */
export type TaxExemptRequest = { taxExempt: boolean; cert?: string };
export type ExemptionStatus = "none" | "active" | "expired" | "missing_cert";
