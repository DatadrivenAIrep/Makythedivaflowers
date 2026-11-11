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
  /** Who saved the date. Only the customer's own may be called "the one you saved". */
  source: "admin" | "customer";
  locale: "es" | "en";
  prefs: DatePreferences | null;
  rewardPercent: number | null;
};

function safeFirstName(full: string): string | null {
  const first = full.trim().split(/\s+/)[0] ?? "";
  return safePersonName(first);
}

/**
 * Neutral wording, as in the 7-day text: an anniversary is "{person}'s", never "yours
 * with", because the label is whoever the date was saved for. "That you saved" is only
 * said of a date the customer saved; one the shop loaded gets the plain form.
 */
function occasion(kind: Input["kind"], person: string | null, saved: boolean, locale: "es" | "en"): string {
  if (locale === "es") {
    const word = kind === "birthday" ? "cumpleaños" : "aniversario";
    if (person) return `en 3 días es el ${word} de ${person}.`;
    return saved ? `en 3 días es un ${word} que guardaste.` : `en 3 días hay un ${word}.`;
  }
  const word = kind === "birthday" ? "birthday" : "anniversary";
  const article = kind === "birthday" ? "a" : "an";
  if (person) return `${person}'s ${word} is in 3 days.`;
  return saved ? `${article} ${word} you saved is in 3 days.` : `there's ${article} ${word} in 3 days.`;
}

function likes(prefs: DatePreferences | null, locale: "es" | "en"): string | null {
  if (!prefs) return null;
  // flowersPhrase skips a code outside the lists, so it never stops a text going out.
  const phrase = flowersPhrase(prefs.flowers[0], prefs.colors[0], locale);
  if (!phrase) return null;
  return locale === "es" ? `Le preparamos ${phrase}, sus flores favoritas.` : `We can make ${phrase}, their favorites.`;
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

  let occ = occasion(kind, person, input.source === "customer", locale);
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
