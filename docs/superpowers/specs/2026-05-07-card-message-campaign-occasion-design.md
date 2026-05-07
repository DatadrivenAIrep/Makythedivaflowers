# Card Message — Campaign-Aware Occasion Picker

**Date:** 2026-05-07
**Status:** Approved, ready for implementation plan
**Scope:** Multi-file fix to the AI assist's occasion picking + sympathy detection

## Problem

Two related defects in the card-message AI assist on the PDP, both visible right now during the Mother's Day campaign:

**Defect 1 — Wrong occasion sent to the AI.**
A product like `angels-touch` carries `occasions: ["mothers-day", "anniversary", "romance", "just-because", "sympathy"]`. The picker in `CardMessage` does `(isSympathy ? "sympathy" : occasions[0]) ?? "just-because"`, so it picks the first array item. For other Mother's Day-eligible products such as `occasions: ["birthday", "just-because", "congrats", "mothers-day"]`, the AI is sent `"birthday"` and writes birthday messages on the Mother's Day landing page. Worse: products tagged `["mothers-day", ...]` first send `"mothers-day"` to the API, which rejects it because the schema enum does not include `"mothers-day"` — so the customer sees a generic error instead of a suggestion.

**Defect 2 — Bogus sympathy detection.**
`CardMessage` infers `isSympathy = occasions.includes("sympathy")`. Any product *tagged with sympathy as one of many possible uses* — such as `angels-touch` (category `arrangements`) — is treated as a sympathy-only product: bare label, no sparkle in the trigger, sympathy-toned AI prompt, sympathy relation chips. The PDP page itself uses the correct check (`product.category === "sympathy"`), so the two sources of truth disagree.

## Goal

Make the AI's occasion match customer intent on Mother's Day-tagged products without reverting to magic, and stop conflating "tagged for sympathy" with "is a sympathy product".

## Non-goals

- No customer-facing UI to pick the occasion. The relation chip row stays the only manual choice in the assist panel.
- No date-window heuristic. The campaign signal must be explicit (URL param), not inferred from `Date.now()`.
- No retroactive re-tagging of products. The `occasions` arrays in `data/products.ts` stay as they are.
- No changes to the assist panel itself, the relation chips, the rate limiter, or the API's response shape.
- Other seasonal campaigns (Father's Day, Valentine's, Christmas) are out of scope for this change. The mechanic is generic; future campaigns reuse it by passing their own `?campaign=<key>` and adding the key to the schema + prompt.
- No changes to `MothersDayHomeStrip` — it's a dismissable home banner that links to the MD landing page, not a product grid.

## Design

### File map

| File                                                     | Change                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas/card-message.ts`                                | Add `"mothers-day"` to `occasionSchema`.                                                                                                                                                                                                              |
| `lib/card-message-prompt.ts`                             | Add one line to `BASE_SYSTEM`: `- mothers-day → mother, gratitude for the unseen labor, the small rituals she made into love`.                                                                                                                       |
| `app/[locale]/product/[slug]/page.tsx`                   | Accept `searchParams: Promise<{ campaign?: string \| string[] }>` (matching the existing async `params` pattern in the same file). Validate against `occasionSchema.options`; drop unknown values silently. Pass the validated `campaign` into `<PdpConfigurator>`. |
| `components/product/PdpConfigurator.tsx`                 | Accept `campaign?: Occasion` prop. Compute `const isSympathy = product.category === "sympathy"` (matches the PDP page) and pass both `isSympathy` and `campaign` to `<CardMessage>`. The local `void motionMode;` line stays as-is.                  |
| `components/product/CardMessage.tsx`                     | Replace the inferred `isSympathy = occasions.includes("sympathy")` with the prop. Update the picker (see below). Remove the now-unused `Occasion` cast on `occasions[0]` if it becomes redundant.                                                     |
| `components/product/ProductGrid.tsx`                     | Add optional `campaign?: string` prop; forward to `<ProductCard>`.                                                                                                                                                                                    |
| `components/product/ProductCard.tsx`                     | Add optional `campaign?: string` prop. If set, append `?campaign=<encoded>` to `href`. Default behavior (no query string) when prop absent.                                                                                                            |
| `components/mothers-day/MothersDayEdit.tsx`              | Pass `campaign="mothers-day"` to `<ProductGrid>`.                                                                                                                                                                                                     |

### Picker logic (in `CardMessage`)

```ts
let occasion: Occasion;
if (isSympathy) {
  occasion = "sympathy";                                              // category beats URL — sympathy SKUs always sympathy-toned
} else if (campaign && occasions.includes(campaign)) {
  occasion = campaign;                                                // explicit campaign signal that the product carries
} else {
  occasion = (occasions[0] as Occasion | undefined) ?? "just-because"; // existing fallback
}
const mode: "default" | "sympathy" = isSympathy ? "sympathy" : "default";
```

### Data flow

```
/es/mothers-day
   └── MothersDayEdit campaign="mothers-day"
         └── ProductGrid campaign="mothers-day"
               └── ProductCard campaign="mothers-day"
                     href = /es/product/angels-touch?campaign=mothers-day
                                                ▼
PDP page reads searchParams, validates "mothers-day" against occasionSchema
   └── PdpConfigurator campaign="mothers-day" isSympathy={category==="sympathy"}
         └── CardMessage campaign="mothers-day" isSympathy={false}
               picker → occasion = "mothers-day"  (because product.occasions includes it)
                                                ▼
POST /api/card-message { occasion: "mothers-day", ... }
   schema accepts; prompt includes the mothers-day tone line
                                                ▼
AI returns Mother's Day-themed suggestions
```

### Validation rules for `?campaign=...`

The PDP page server component validates the param before threading it down:

```ts
const sp = await searchParams;
const rawCampaign = Array.isArray(sp.campaign) ? sp.campaign[0] : sp.campaign;
const campaign: Occasion | undefined =
  rawCampaign && (occasionSchema.options as readonly string[]).includes(rawCampaign)
    ? (rawCampaign as Occasion)
    : undefined;
```

- Unknown values are silently dropped (open URLs with `?campaign=hacker` simply behave as no-campaign).
- Array form (`?campaign=a&campaign=b`) takes the first value.
- Empty string is treated as undefined.

## Edge cases

| Scenario                                                                                  | Behavior                                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| MD landing page → MD-tagged product                                                       | ✅ `?campaign=mothers-day` propagates → AI gets `mothers-day` → MD-themed messages.                                     |
| MD landing page → product whose `occasions` does NOT include `mothers-day`                | Picker falls back to `occasions[0]` (campaign is ignored because the product doesn't carry it). Defensive.             |
| Direct PDP visit (no campaign param)                                                      | Existing behavior: `occasions[0] ?? "just-because"`. Slightly wrong messages on MD-only products. Accepted tradeoff.    |
| `?campaign=hacker` typed into URL                                                         | Server validation drops it. Same behavior as no campaign.                                                                |
| Sympathy SKU (`category === "sympathy"`) with `?campaign=mothers-day`                     | `isSympathy` short-circuits → occasion stays `"sympathy"`. Sympathy treatment is non-negotiable.                        |
| Product like `angels-touch` (sympathy in `occasions` but `category === "arrangements"`)   | `isSympathy = false` now. Sparkle returns. With `?campaign=mothers-day` the AI gets `mothers-day`.                      |
| MD-tagged product accessed via subscription form                                          | Out of scope — `SubscriptionInquiryForm` reuses `CardMessageAssist` directly, not `CardMessage`. Behavior unchanged.    |

## Testing

**New / extended unit tests:**

1. **`tests/unit/card-message-schema.test.ts`** — assert `"mothers-day"` is now an accepted `occasion`.
2. **`tests/unit/card-message-prompt.test.ts`** — extend the existing "tone hints" test to also expect `"mothers-day"` in `system.toLowerCase()`. Add one test asserting the new line wording (e.g. matches `/mother.*gratitude/i`).
3. **`tests/unit/CardMessage.test.tsx`** — add tests:
   - Sympathy detection: when `isSympathy` prop is `true`, the trigger uses the sympathy label (currently asserted indirectly via relation chips). When `isSympathy` is `false` *and* `occasions` happens to include `"sympathy"`, the trigger uses the default label and sparkle. Test names should explicitly mention "isSympathy prop".
   - Campaign picker: when `campaign="mothers-day"` is passed and `occasions` includes `"mothers-day"`, the API request body sent on Generate uses `occasion: "mothers-day"`. Use `vi.spyOn(global, "fetch")` (already used elsewhere) to capture the body.
   - Campaign defensive: when `campaign="mothers-day"` is passed but `occasions` does NOT include it, the request body falls back to `occasions[0]`.
   - Sympathy beats campaign: when `isSympathy=true` and `campaign="mothers-day"`, the request body uses `occasion: "sympathy"`.
4. **`tests/unit/CardMessageAssist.test.tsx`** — unaffected; this component receives `occasion` as a prop and just forwards it.
5. **API route test (`card-message-route.test.ts`)** — add one happy-path test for `occasion: "mothers-day"`.

**Manual verification on dev server:**
1. `/en/mothers-day` → click any MD-tagged product → URL has `?campaign=mothers-day` → suggestions are MD-themed.
2. `/en/product/angels-touch` (no campaign) → trigger now shows `✨ Need ideas? Suggest a message` (not the bare sympathy label) → suggestions match `just-because`.
3. `/en/product/<a true sympathy SKU>` → unchanged: bare "Suggest message", sympathy chip set, sympathy-toned suggestions.
4. `/en/product/angels-touch?campaign=hacker` → behaves as no campaign.

## Risks

- **Schema additions are forward-only.** Adding `"mothers-day"` to the enum is safe; existing data and code only ever sent `birthday|anniversary|sympathy|romance|congrats|just-because`. No migration.
- **Next 15 async `searchParams`.** The existing `params` in the PDP page is already async (`Promise<{ locale, slug }>`), so the project is on Next 15+. The implementer should follow the same `await` pattern. Consult `node_modules/next/dist/docs/` if anything looks off — the project notes Next has breaking changes from training-data assumptions.
- **`ProductCard` is shared.** Many surfaces use it. The new `campaign` prop is optional and defaults to undefined → existing call sites unaffected. Verify by grep that no call site mistakenly passes a campaign string.
- **Querystring caching.** Adding `?campaign=mothers-day` to product links does not affect Next's per-route static generation; product detail pages are pre-rendered via `generateStaticParams` and the search-param branch runs in the dynamic data layer. No change to ISR/SSG behavior, but worth a manual sanity-check after deploy.
- **`isSympathy` regression.** `CardMessage`'s sympathy mode currently controls (a) trigger label, (b) relation chip set via `getRelations(mode, ...)`, and (c) AI tone. Switching the source of truth from `occasions.includes("sympathy")` to `category === "sympathy"` flips a real chunk of behavior on products like `angels-touch`. That is intended — `angels-touch` is an arrangement, not a sympathy SKU. Document this clearly in the commit message so it's not mistaken for an accidental regression at PR review time.
