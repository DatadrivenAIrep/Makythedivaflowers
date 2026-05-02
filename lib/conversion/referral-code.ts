// lib/conversion/referral-code.ts
export function deriveReferralCode(orderId: string): string {
  const cleaned = orderId.replace(/[^a-zA-Z0-9]/g, "");
  const tail = cleaned.slice(-6).padStart(6, "X").toUpperCase();
  return `DIVA-${tail}`;
}
