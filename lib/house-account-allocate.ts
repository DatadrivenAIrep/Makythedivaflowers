// Pure: spread a payment over targets oldest-first. Used for open account
// orders (targets = orders, due = total − amount_paid). Any surplus is the
// caller's business (it stays on the account balance as credit).
export type AllocationTarget = { id: string; dueCents: number };
export type Allocation = { id: string; appliedCents: number };

export function allocate(targets: AllocationTarget[], amountCents: number): Allocation[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return [];
  let remaining = amountCents;
  const out: Allocation[] = [];
  for (const t of targets) {
    if (remaining <= 0) break;
    const due = Math.max(0, t.dueCents);
    if (due === 0) continue;
    const applied = Math.min(due, remaining);
    out.push({ id: t.id, appliedCents: applied });
    remaining -= applied;
  }
  return out;
}
