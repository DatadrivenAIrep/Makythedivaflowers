function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseCutoff(cutoff: string): { hour: number; minute: number } {
  const [h, m] = cutoff.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export function isSameDayEligible(now: Date, cutoff: string): boolean {
  const { hour, minute } = parseCutoff(cutoff);
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  return now.getTime() < c.getTime();
}

export function isPastDate(iso: string, now: Date): boolean {
  const today = toIsoDate(now);
  return iso < today;
}

export function listAvailableDates(
  now: Date,
  cutoff: string,
  daysAhead: number,
): string[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (!isSameDayEligible(now, cutoff)) {
    start.setDate(start.getDate() + 1);
  }
  const out: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toIsoDate(d));
  }
  return out;
}
