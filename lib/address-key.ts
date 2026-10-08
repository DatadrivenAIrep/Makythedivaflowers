import type { Address } from "@/types/address";

// Same street + apt + ZIP is the same place, however it was capitalized,
// punctuated or spaced. Shared by the server (recipient history, funeral homes)
// and the intake form, so "is this the address already on the order?" agrees.
export function addressKey(a: Pick<Address, "street1" | "street2" | "zip">): string {
  const norm = (v: string | undefined) => (v ?? "").toLowerCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
  return `${norm(a.street1)}|${norm(a.street2)}|${(a.zip ?? "").slice(0, 5)}`;
}

export function sameAddress(a: Pick<Address, "street1" | "street2" | "zip">, b: Pick<Address, "street1" | "street2" | "zip">): boolean {
  return addressKey(a) === addressKey(b);
}
