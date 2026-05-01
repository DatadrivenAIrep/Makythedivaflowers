# Card-message AI assistant (PDP) — design

**Date:** 2026-05-01
**Status:** approved for planning
**Owner:** Santiago

## §1 Summary and scope

Add an AI assistant inside the PDP `CardMessage` component that generates three card-message suggestions on demand. The customer clicks an inline trigger, picks a relation chip, receives three Claude-generated suggestions in their current locale, and selecting one loads it into the existing `<textarea>` for further editing. The manual textarea remains untouched — the assistant is opt-in and additive.

**In scope**
- Inline UI inside `CardMessage` (PDP).
- POST `/api/card-message` returning three suggestions.
- Claude Haiku 4.5 via `@anthropic-ai/sdk`.
- Per-IP in-memory rate limit (20 req/h).
- Sympathy-mode variant with different relation chips and tone.
- Anonymous server-side telemetry (occasion, relation, locale, ok/fail) — no IP, no message content.
- Localized in `en` / `es`, generation in the current locale only.

**Out of scope**
- Assistant in the checkout `DeliveryStep`.
- Multi-turn conversation, refinement of customer-written drafts.
- Translation between locales.
- Storing generated messages server-side, A/B testing, marking the message source on `CartItem`.
- CAPTCHA / Turnstile (deferred until logs justify it).

## §2 Architecture and files

```
components/product/
  CardMessage.tsx           — refactored: textarea + access to assist
  CardMessageAssist.tsx     — new: chips, generate button, suggestion cards, error state
  CardMessageSkeleton.tsx   — new: three pulsing placeholders during loading

lib/
  card-message/
    prompt.ts               — new: build Claude system+user prompt from input
    relations.ts            — new: relation chip sets (default vs sympathy), localized labels
    rate-limit.ts           — new: in-memory Map<ip, timestamps[]>, 20 req/h
    types.ts                — new: CardMessageRequest, CardMessageResponse, RelationKey

app/api/card-message/
  route.ts                  — new: POST handler (zod → rate-limit → Anthropic → JSON)

messages/
  en.json, es.json          — edited: card_message.assist.* keys

components/product/PdpConfigurator.tsx — edited: pass productTitle + occasions to CardMessage
```

**Boundaries.** The route handler is server-only and is the sole importer of `@anthropic-ai/sdk`; the SDK never reaches the client bundle. `lib/card-message/{prompt,relations,types}` are pure and isomorphic; `rate-limit.ts` is server-only. `CardMessageAssist` is a leaf component owning its own state and emitting `onPick(text)` to the parent.

**New dependency:** `@anthropic-ai/sdk`. `zod` is already present.

## §3 Data flow and API contract

### Request

```ts
// POST /api/card-message
{
  productTitle: string;       // ≤ 80 chars, sourced from catalog
  occasion: "birthday" | "anniversary" | "sympathy" | "romance" | "congrats" | "just-because";
  relation:
    // default mode
    | "partner" | "mother" | "father" | "friend" | "family" | "other"
    // sympathy mode
    | "family" | "close-friend" | "coworker" | "other";
  locale: "en" | "es";
}
```

Validated server-side with zod. Failure → HTTP 400 with `{ error: "invalid_input" }`.

### Response

```ts
// HTTP 200
{ suggestions: [string, string, string] }

// HTTP 429
{ error: "rate_limit" }

// HTTP 400
{ error: "invalid_input" }

// HTTP 502
{ error: "upstream" }
```

### Server pipeline

1. `zod.parse` body → 400 on failure.
2. Extract IP from `request.headers.get("x-forwarded-for")` (first comma-separated value); fallback `"unknown"`.
3. Rate-limit check via `lib/card-message/rate-limit.ts`. If `count(ip, lastHour) >= 20` → 429.
4. Build prompt with `lib/card-message/prompt.ts`. Returns `{ system: string, user: string }`.
5. Call `anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 600, system, messages: [{ role: "user", content: user }] })` with an `AbortController` timeout of 8 s.
6. Parse the assistant's content as JSON; expect `{ suggestions: string[3] }`. If parsing fails or array length is not exactly 3 → 502 and `console.error` the malformed content.
7. Each suggestion is trimmed and capped at 200 characters server-side (defensive — matches textarea max).
8. Emit telemetry: `console.log(JSON.stringify({ event: "card_message", occasion, relation, locale, ok: true, ts: Date.now() }))`. No IP, no content.
9. Return `{ suggestions }`.

If `process.env.ANTHROPIC_API_KEY` is absent at module load, the handler responds 502 immediately (with a one-time `console.error`) instead of throwing. Other PDP functionality is unaffected.

### Prompt design (full text)

**System prompt (locale-aware):**

```
You are an assistant that writes greeting-card messages for a Long Island
florist (Diva Flowers).

You MUST respond with strictly valid JSON in exactly this shape:
{"suggestions": ["…", "…", "…"]}

No prose before or after. No markdown. Exactly three suggestions.

Each suggestion:
- Is written in {LOCALE_NAME} ({locale}).
- Is 1–2 sentences, between 12 and 30 words.
- Carries a distinct register from the other two: one tender, one
  warm-and-short, one with a specific image or unexpected turn.
- Does NOT include the literal product name.
- Does NOT contain a signature, name placeholder, or "—Love, X".
- Avoids these banned words in any language:
  hermoso, lindo, perfecto, increíble, único, especial,
  beautiful, perfect, amazing, unique, special.

Tone varies by occasion:
- anniversary → years, ritual, the long conversation
- birthday → celebration, small joys, the laugh
- romance → pulse, surprise, presence
- just-because → the small gesture that lands big
- congrats → pride, milestone, "you did it"
- sympathy → dignity, quiet presence, no clichés, no "thoughts and prayers",
  no metaphors of light/journey beyond what feels honest
```

**User prompt:**

```
Product: {productTitle}
Occasion: {occasion}
Recipient relation: {relation}
Output language: {locale}
```

`{LOCALE_NAME}` resolves to "Spanish" or "English". Sympathy mode appends an extra system clause: *"This is a sympathy message. Lead with quiet presence over performance. No religious assumptions. Avoid 'rest in peace' / 'descansa en paz' as openers — too generic."*

## §4 UI and states

### Resting state

`CardMessage` renders the existing label, textarea, and right-aligned counter as today. A new inline trigger button sits on the same line as the counter, left-aligned (counter stays right-aligned). Same baseline:

```
✨ Sugerir mensaje    /    ✨ Suggest message
```

Same typography as the counter (`font-mono text-xs text-mute-500`). The leading sparkle emoji is omitted in sympathy mode.

If the customer never clicks it, behavior is identical to the pre-change `CardMessage`.

### Expanded panel (relation picker)

Clicking the trigger expands a panel directly above the textarea with a 150 ms fade+slide:

```
¿Para quién es?    /    Who's it for?

[ Pareja ]  [ Mamá ]  [ Papá ]  [ Amigx ]
[ Familia ]  [ Otro ]

                              [ Generar 3 ideas ]   [×]
```

- Chips reuse the visual language of `VariantChips` (thin border, hover, filled when selected).
- "Generate" is disabled until a chip is selected.
- `[×]` collapses without generating.

**Sympathy mode** (`product.occasions.includes("sympathy")`):

```
¿Para quién es?    /    Who's it for?

[ Familia ]  [ Amistad cercana ]
[ Compañerx de trabajo ]  [ Otro ]

                              [ Generar 3 mensajes ]   [×]
```

No sparkle. Button copy is "Generar 3 mensajes" / "Generate 3 messages".

### Loading

Skeleton replaces the chip area: three vertically stacked placeholder cards with `animate-pulse` on `bg-ink/10`. Live region announces "Generando sugerencias…" / "Generating suggestions…" via `aria-live="polite"`.

### Success

Three suggestion cards. Each is a `<button>` with `aria-label="Usar esta sugerencia: {text}"`:

```
┌────────────────────────────────────────┐
│ {suggestion 1}                          │
├────────────────────────────────────────┤
│ {suggestion 2}                          │
├────────────────────────────────────────┤
│ {suggestion 3}                          │
└────────────────────────────────────────┘

                       [ ↻ Generar otras 3 ]
```

- Hover darkens the border, cursor is pointer.
- Click → call `onPick(text)` → parent updates the textarea value → panel collapses with reverse animation → focus returns to the textarea with caret at the end.
- "Generar otras 3" calls the same generate handler, reusing the previously selected `relation`. Counts against the rate limit.

### Error

Same panel area; cards/skeleton replaced by:

```
⚠ No pudimos generar ahora.
   Mientras tanto, escribe el tuyo.

           [ Reintentar ]
```

- For `rate_limit`: copy becomes "Pediste muchas en poco tiempo. Vuelve a intentarlo en una hora." / "Too many requests. Please try again in an hour."
- For other errors: generic copy as above.
- `aria-live="assertive"` on the error container.
- Reintentar reuses the selected relation.

### Mobile

- Suggestion cards stack vertically (no horizontal scroll).
- Relation chips wrap to 2–3 per row.
- The trigger remains right-aligned next to the counter.

### Accessibility

- Trigger has `aria-expanded` matching the panel state.
- On open: focus moves to the first relation chip.
- On suggestion pick: focus returns to the textarea, caret at end.
- Each suggestion card is a `<button>` with full keyboard support (Enter/Space).
- Chips use `aria-pressed` to indicate selection.
- Live regions use `polite` for loading and `assertive` for error.
- Color tokens follow existing usage (`ink`, `mute-500`, `rouge` focus ring).

## §5 Testing

### Unit (vitest)

- `tests/unit/lib/card-message/relations.test.ts` — default mode returns 6 chips; sympathy returns 4; localized labels for `en` and `es`.
- `tests/unit/lib/card-message/prompt.test.ts` — system prompt contains banned-word list + locale name + JSON-only directive; user prompt contains all four input fields verbatim; sympathy mode appends sympathy clause.
- `tests/unit/lib/card-message/rate-limit.test.ts` — 20 within window allowed; 21st rejected; separate IPs independent; entries older than 1 hour expire (mock `Date.now`); IP `"unknown"` is rate-limited like any other.
- `tests/unit/api/card-message.test.ts` — invalid body → 400; rate-limited → 429; happy path with mocked SDK → 200 with three strings; SDK returns malformed JSON / wrong array length → 502; SDK throws → 502; logs structured event with no IP/content; missing `ANTHROPIC_API_KEY` → 502 + console.error.

### Component (vitest + @testing-library/react)

- `tests/unit/components/CardMessageAssist.test.tsx` — initial state has Generate disabled; selecting a chip enables it; clicking Generate shows skeleton; mocked fetch returning 3 suggestions renders 3 cards; clicking a card calls `onPick` with the right text; 429 mock shows rate-limit copy; 502 mock shows generic error + Reintentar; Reintentar reuses the previously selected relation; sympathy-mode prop renders sympathy chips and adjusted copy.
- `tests/unit/components/CardMessage.test.tsx` — without engaging the assistant, behavior matches the pre-change component (textarea, counter, maxLength); after `onPick`, textarea value updates, panel collapses, focus is on textarea.

### E2E (playwright)

`tests/e2e/card-message-ai.spec.ts`:
- Visit `/en/product/all-my-love` → click "Suggest message" → click "Partner" chip → click "Generate 3 ideas" with `/api/card-message` mocked to return 3 fixed suggestions → first card click populates the textarea with that suggestion → panel is collapsed.
- Visit a product with `occasions: ["sympathy"]` (e.g. `lilies-for-lottie`) → trigger shows sympathy-tone copy and chips.
- Mock 429 → verifies rate-limit copy.

### Out of scope for tests

- Real Anthropic API calls (mocked everywhere).
- Visual regression beyond the existing percy/playwright setup.
- Performance benchmarks.

## §6 Risks and mitigations

- **Cost runaway.** Layer 1: per-IP rate limit (20/h). Layer 2: monthly spend cap configured in Anthropic Console (owner action). If both fail, damage is bounded by the cap. Watch logs weekly initially; if a cap is approached, add Turnstile.
- **Malformed model output.** Strict JSON-only system instruction + zod validation; failure → 502 with logged content. Follow-up if seen in logs: post-filter for banned words and one retry.
- **Provider latency / outage.** 8 s `AbortController` timeout client-side; same `signal` passed to the SDK. Timeout → 502. Customer sees error inline, can retry; rest of PDP is unaffected.
- **Rate-limit memory loss on cold start.** Map lives in process memory; Vercel restarts reset it. Theoretical attacker bypass adds maybe 40–60 req/h. Acceptable until logs show abuse; migration to Vercel KV is ~10 lines.
- **Prompt injection.** Inputs are typed enums plus `productTitle` from the catalog (not user-typed). zod restricts `productTitle` to `≤ 80` chars and a permissive regex (letters, numbers, common punctuation). No free-text reaches the prompt.
- **Lost manual draft.** The panel is additive — opening it does not touch the textarea. `onPick` only fires on explicit card click. `[×]` cancels without state change to the textarea.
- **Bundle bloat.** `@anthropic-ai/sdk` is imported only by the route handler; verified post-implementation with `grep -r "@anthropic-ai" components/`.
- **Missing API key in dev.** Handler degrades gracefully to 502; client shows error; rest of PDP works.

## §7 Delivery plan

1. **Setup** — add `@anthropic-ai/sdk` to `package.json`. No code yet.
2. **Pure libs (TDD)** — `relations.ts`, `prompt.ts`, `rate-limit.ts`, `types.ts` with their unit tests.
3. **Route handler (TDD)** — `app/api/card-message/route.ts` with mocked SDK.
4. **Components (TDD)** — `CardMessageSkeleton`, `CardMessageAssist`, refactor `CardMessage`.
5. **i18n** — add keys to `messages/en.json` and `messages/es.json`; verify `tsc --noEmit`.
6. **PDP wiring** — pass `productTitle` and `occasions` from `PdpConfigurator` to `CardMessage`.
7. **E2E** — playwright spec with mocked route.
8. **Manual smoke** — owner adds `ANTHROPIC_API_KEY` to `.env.local`, generates against three occasions (anniversary, birthday, sympathy), verifies voice rules and JSON shape.
9. **Commit** — single `feat(pdp): AI card-message assistant` after typecheck + tests + build are green; or split per step 2/3/4 if preferred.

No feature flag — opt-in by design and graceful degradation if the API key is missing.

## Acceptance criteria

- Customer on any PDP can click "Suggest message", pick a relation, and receive three localized suggestions in under 8 s under nominal conditions.
- Selecting a suggestion replaces the textarea content and the customer can edit it; nothing else in the PDP changes.
- Without engaging the assistant, the textarea behaves exactly as before this change.
- Sympathy-classified products show sympathy-mode chips and tone-adjusted output.
- Rate-limited requests show the rate-limit-specific message.
- API failures show a generic error with Reintentar and never crash the PDP.
- All existing tests pass; new unit, component, and e2e tests pass.
- `tsc --noEmit` is clean. `npm run build` succeeds.
- Anonymous telemetry is emitted on every successful generation; no IP or message content is logged.
