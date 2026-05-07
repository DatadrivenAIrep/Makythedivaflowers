import type { CardMessageRequest } from "@/schemas/card-message";

const LOCALE_NAMES = { en: "English", es: "Spanish" } as const;

const BASE_SYSTEM = `You are an assistant that writes greeting-card messages for a Long Island florist (Diva Flowers).

You MUST respond with strictly valid JSON in exactly this shape:
{"suggestions": ["…", "…", "…"]}

No prose before or after. No markdown. Exactly three suggestions.

Each suggestion:
- Is written in {LOCALE_NAME} ({locale}).
- Is 1–2 sentences, between 12 and 30 words.
- Carries a distinct register from the other two: one tender, one warm-and-short, one with a specific image or unexpected turn.
- Does NOT include the literal product name.
- Does NOT contain a signature, name placeholder, or "—Love, X".
- Avoids these banned words in any language: hermoso, lindo, perfecto, increíble, único, especial, beautiful, perfect, amazing, unique, special.

Tone varies by occasion:
- anniversary → years, ritual, the long conversation
- birthday → celebration, small joys, the laugh
- romance → pulse, surprise, presence
- just-because → the small gesture that lands big
- congrats → pride, milestone, "you did it"
- sympathy → dignity, no clichés
- mothers-day → mother, gratitude for the unseen labor, the small rituals she made into love`;

const SYMPATHY_CLAUSE = `

This is a sympathy message. Lead with quiet presence over performance. No religious assumptions. Avoid "rest in peace" / "descansa en paz" as openers — too generic. Speak to the person, not at the loss.`;

export function buildCardMessagePrompt(input: CardMessageRequest): { system: string; user: string } {
  const localeName = LOCALE_NAMES[input.locale];
  let system = BASE_SYSTEM
    .replace("{LOCALE_NAME}", localeName)
    .replace("{locale}", input.locale);

  if (input.occasion === "sympathy") {
    system += SYMPATHY_CLAUSE;
  }

  const user = `Product: ${input.productTitle}
Occasion: ${input.occasion}
Recipient relation: ${input.relation}
Output language: ${input.locale}`;

  return { system, user };
}
