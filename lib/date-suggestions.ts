// Spots dates worth remembering from order history: a recipient who gets
// flowers around the same day in more than one year almost always has a
// birthday or an anniversary then. Pure — the profile feeds it from the DB.

export type SuggestionRecipient = {
  name: string;
  /** Last 10 digits, or "" when the orders carried no usable phone. */
  phone: string;
  /** Order days (YYYY-MM-DD) for this recipient, any order. */
  days: string[];
};

export type SavedDateLike = { month: number; day: number; label?: string; recipientPhone?: string };

export type SuggestionInput = {
  recipients: SuggestionRecipient[];
  saved: SavedDateLike[];
  /** Keys the shop turned down. */
  dismissed: Set<string>;
};

export type DateSuggestion = {
  /** Stable id: recipient + month-day, used to save or dismiss it. */
  key: string;
  recipientName: string;
  recipientPhone: string;
  month: number;
  day: number;
  /** Years the recipient got flowers around this day, ascending. */
  years: number[];
};

/** Days apart that still count as "the same date" from one year to the next. */
const DRIFT_DAYS = 5;
/** A saved date this close to a pattern already covers it. */
const SAVED_MATCH_DAYS = 7;
const YEAR_DAYS = 365;

// Valentine's and Mother's Day weeks: everyone orders then, and the seasonal
// campaigns already remind people, so they are not personal dates.
const HOLIDAY_WINDOWS: Array<{ month: number; from: number; to: number }> = [
  { month: 2, from: 7, to: 14 },
  { month: 5, from: 7, to: 14 },
];

type Day = { ymd: string; year: number; month: number; day: number; doy: number };

/** Day of year on a fixed non-leap calendar, so the same date lines up across years. */
function dayOfYear(month: number, day: number): number {
  const d = month === 2 ? Math.min(day, 28) : day;
  return Math.round((Date.UTC(2001, month - 1, d) - Date.UTC(2001, 0, 1)) / 86_400_000);
}

function parse(ymd: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { ymd, year, month, day, doy: dayOfYear(month, day) };
}

function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, YEAR_DAYS - d);
}

/** Groups days that fall within DRIFT_DAYS of their neighbour, wrapping Dec→Jan. */
function cluster(days: Day[]): Day[][] {
  const sorted = [...days].sort((a, b) => a.doy - b.doy);
  const groups: Day[][] = [];
  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (last && d.doy - last[last.length - 1].doy <= DRIFT_DAYS) last.push(d);
    else groups.push([d]);
  }
  if (groups.length > 1) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    if (first[0].doy + YEAR_DAYS - last[last.length - 1].doy <= DRIFT_DAYS) {
      groups[0] = [...last, ...first];
      groups.pop();
    }
  }
  return groups;
}

function inHoliday(month: number, day: number): boolean {
  return HOLIDAY_WINDOWS.some((w) => w.month === month && day >= w.from && day <= w.to);
}

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

const pad = (n: number) => String(n).padStart(2, "0");

export function suggestRecipientDates({ recipients, saved, dismissed }: SuggestionInput): DateSuggestion[] {
  const out: DateSuggestion[] = [];
  for (const r of recipients) {
    const days = r.days.map(parse).filter((d): d is Day => d !== null);
    const who = r.phone || `name:${norm(r.name)}`;
    const savedForRecipient = saved.filter(
      (s) => (r.phone && s.recipientPhone === r.phone) || (norm(s.label) !== "" && norm(s.label) === norm(r.name)),
    );
    for (const group of cluster(days)) {
      const years = [...new Set(group.map((d) => d.year))].sort((a, b) => a - b);
      if (years.length < 2) continue;
      const latest = group.reduce((a, b) => (b.ymd > a.ymd ? b : a));
      if (inHoliday(latest.month, latest.day)) continue;
      if (savedForRecipient.some((s) => circularDistance(dayOfYear(s.month, s.day), latest.doy) <= SAVED_MATCH_DAYS)) continue;
      const key = `${who}:${pad(latest.month)}-${pad(latest.day)}`;
      if (dismissed.has(key)) continue;
      out.push({ key, recipientName: r.name, recipientPhone: r.phone, month: latest.month, day: latest.day, years });
    }
  }
  return out;
}
