// Pure helpers for reading loyalty rewards. No server-only import: usable anywhere.

export type LoyaltyReward = { id: string; percent: number; label: string };

// A reward is a percent discount only when its text holds exactly one "N%"
// with N between 1 and 99. Anything else (free item, "10% + 5%", 100%) is not applicable.
export function rewardPercent(text: string): number | null {
  const matches = [...text.matchAll(/(\d{1,3})\s*%/g)];
  if (matches.length !== 1) return null;
  const n = Number(matches[0][1]);
  return n >= 1 && n <= 99 ? n : null;
}

export function applicableRewards(available: { id: string; reward: string }[]): LoyaltyReward[] {
  const out: LoyaltyReward[] = [];
  for (const r of available) {
    const percent = rewardPercent(r.reward);
    if (percent !== null) out.push({ id: r.id, percent, label: r.reward });
  }
  return out.sort((a, b) => b.percent - a.percent);
}

export function rewardDiscountCents(subtotalCents: number, percent: number): number {
  return Math.min(Math.round((subtotalCents * percent) / 100), subtotalCents);
}
