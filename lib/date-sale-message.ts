import { OPT_OUT_FOOTER } from "@/lib/campaign-sender";
import { smsSegments } from "@/lib/sms-segments";
import { flowersPhrase } from "@/lib/date-preference-options";
import type { DatePreferences } from "@/lib/date-preferences-storage";

/**
 * The 3-day sales text. It goes to the buyer only, never to the person the date
 * is about, so nothing in it may be free text that could carry a link or an odd
 * character: names pass a letters-and-spaces filter or are left out, and taste
 * wording comes from fixed tables ("avoid" codes are never used).
 */

const SAFE_NAME = /^[\p{L} ]{1,40}$/u;
const MAX_SEGMENTS = 4;

export function safePersonName(label?: string): string | null {
  const t = label?.trim();
  return t && SAFE_NAME.test(t) ? t : null;
}

type Input = {
  customerName: string;
  kind: "birthday" | "anniversary";
  label?: string;
  locale: "es" | "en";
  prefs: DatePreferences | null;
  rewardPercent: number | null;
};

function safeFirstName(full: string): string | null {
  const first = full.trim().split(/\s+/)[0] ?? "";
  return safePersonName(first);
}

function occasion(kind: Input["kind"], person: string | null, locale: "es" | "en"): string {
  if (locale === "es") {
    if (kind === "birthday") {
      return person ? `en 3 días es el cumpleaños de ${person}.` : "en 3 días es un cumpleaños que guardaste.";
    }
    return person ? `en 3 días es tu aniversario con ${person}.` : "en 3 días es tu aniversario.";
  }
  if (kind === "birthday") {
    return person ? `${person}'s birthday is in 3 days.` : "a birthday you saved is in 3 days.";
  }
  return person ? `your anniversary with ${person} is in 3 days.` : "your anniversary is in 3 days.";
}

function likes(prefs: DatePreferences | null, locale: "es" | "en"): string | null {
  if (!prefs) return null;
  try {
    const phrase = flowersPhrase(prefs.flowers[0], prefs.colors[0], locale);
    if (!phrase) return null;
    return locale === "es" ? `Le preparamos ${phrase}, sus favoritas.` : `We can make ${phrase}, their favorites.`;
  } catch {
    // A code outside the list must never stop a text going out.
    return null;
  }
}

export function renderSaleReminder(input: Input): string {
  const { kind, locale } = input;
  const name = safeFirstName(input.customerName);
  const person = safePersonName(input.label);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  const link = `${base}/${locale}/ocasiones/${kind}`;
  const question = locale === "es" ? "¿Te lo preparamos?" : "Want us to make something?";
  const reward =
    input.rewardPercent == null
      ? null
      : locale === "es"
        ? `Tienes ${input.rewardPercent}% en tu tarjeta.`
        : `You have ${input.rewardPercent}% off on your card.`;

  let occ = occasion(kind, person, locale);
  if (!name && locale === "en") occ = occ.charAt(0).toUpperCase() + occ.slice(1);

  const build = (offer: string) =>
    [
      `Diva Flowers: ${name ? `${name}, ` : ""}${occ}`,
      offer,
      reward,
      locale === "es" ? `Pídelo: ${link}` : `Order: ${link}`,
      OPT_OUT_FOOTER[locale],
    ]
      .filter(Boolean)
      .join(" ");

  const withLikes = build(likes(input.prefs, locale) ?? question);
  return smsSegments(withLikes) > MAX_SEGMENTS ? build(question) : withLikes;
}
