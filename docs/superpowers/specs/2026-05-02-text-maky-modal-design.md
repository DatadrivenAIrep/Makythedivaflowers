# Text Maky Modal — Design Spec

**Date:** 2026-05-02
**Owner:** Santiago
**Status:** Draft for review

## Overview

A contact modal that lets visitors text Maky's personal mobile number (`+1 (516) 851-2815`) directly from high-intent pages. The modal pre-fills a message based on the page where the visitor clicked, offers three contact channels (SMS, WhatsApp, Call), and is bilingual (en/es).

The mobile number used here is Maky's personal line and is intentionally **separate** from the existing business phone in `data/site.ts` (`+1 (516) 484-3456`).

## Goals

- Capture high-intent moments — product, shop, weddings, events, cart, checkout — with a low-friction "ask a question" path that doesn't require filling out a form.
- Pre-fill context so Maky knows what page the visitor was on without the visitor needing to explain.
- Keep the editorial brand voice intact: refined, calm, no chat-bubble cliché.
- Offer alternatives (WhatsApp, Call) for visitors who don't text or are on desktop without an SMS app.

## Non-Goals

- No sending SMS through a backend / Twilio. The modal opens the user's native messaging app via `sms:` / `wa.me` / `tel:` deep links only.
- No persisted conversation history, no analytics in the first cut (one TODO comment is left for future tracking).
- No appearance on editorial routes (home, story, journal, legal, account, contact, order/confirmation). Contact page already has its own form; the inline link is enough there.

## Architecture

### New files

- `components/contact/TextMakyModal.tsx` — client component. Uses Radix `Dialog` directly (not the existing `Sheet` wrapper) so we can vary the layout: bottom-sheet under `md:`, centered card from `md:` up. Owns no state besides what Radix provides; reads page subject from context + i18n.
- `components/contact/TextMakyTrigger.tsx` — client component. Floating fixed button bottom-right. Reads `usePathname()`, decides whether to render at all (route allowlist), opens the modal.
- `components/contact/TextMakyInlineLink.tsx` — client component. Plain anchor-styled trigger ("Text Maky directly →") for use inside footer and contact page. Opens the same modal.
- `components/contact/ContactContextProvider.tsx` — client component. Provides a React Context so pages can register a more specific subject (e.g. PDP product name, shop category). Default state is `null`; the trigger falls back to pathname-based detection when no override is set.
- `lib/contact-subject.ts` — pure function `getSubjectKey({ pathname, locale, override })` that returns `{ key: SubjectKey, vars?: Record<string,string> }`. Pure, no React, easy to unit test.

### Modified files

- `data/site.ts` — add a `mobile` block:
  ```ts
  mobile: {
    display: "+1 (516) 851-2815",
    tel: "tel:+15168512815",
    e164: "+15168512815",
  }
  ```
  The existing `phone`/`phoneHref`/`phoneDisplay` (business line) stays untouched.
- `messages/en.json` and `messages/es.json` — add a `text_modal` namespace (full keys listed below).
- `app/[locale]/layout.tsx` — wrap the children with `<ContactContextProvider>` and mount `<TextMakyTrigger />` once globally. The trigger self-hides on disallowed routes.
- `app/[locale]/product/[slug]/page.tsx` — render a small client child that calls `useSetContactSubject({ kind: "pdp", productName: product.name })` so the SMS body includes the actual product name.
- `app/[locale]/shop/[category]/page.tsx` — same pattern with `{ kind: "shop", category }`.
- `components/nav/Footer.tsx` — add `<TextMakyInlineLink />` next to the phone block.
- `app/[locale]/contact/page.tsx` — add `<TextMakyInlineLink />` near the form (subtle secondary path for visitors who'd rather text than fill a form).

### Routes that show the floating button

Allowlist matched against the **locale-stripped** pathname:

| Pathname pattern | Subject key |
|---|---|
| `/product/[slug]` | `pdp_named` (with override) or `pdp_generic` |
| `/shop` | `shop_all` |
| `/shop/[category]` | `shop_category` (with override) |
| `/weddings` | `weddings` |
| `/events` | `events` |
| `/cart` | `checkout` |
| `/checkout` | `checkout` |

Any pathname not in this list → trigger does not render. The inline link in the footer is the only entry point for editorial routes.

## Data Flow

```
                  ┌──────────────────────────────┐
PDP / Shop ────▶  │ useSetContactSubject(...)    │
(client child)    │ writes override into Context │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ ContactContext (override?)   │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
TextMakyTrigger ─▶ getSubjectKey({ pathname, locale, override })
                                 │
                                 ▼
                  { key: "pdp_named", vars: { product: "Garden Bloom" } }
                                 │
                                 ▼
                  TextMakyModal renders preview:
                    greeting   = t("text_modal.greeting")
                    subject    = t(`text_modal.subjects.${key}`, vars)
                    message    = `${greeting}${subject}`
                                 │
                                 ▼
                  CTAs build hrefs:
                    smsHref       = `sms:+15168512815?&body=${enc}`
                    whatsappHref  = `https://wa.me/15168512815?text=${enc}`
                    telHref       = `tel:+15168512815`
```

### `getSubjectKey` rules (pseudo)

```ts
export type SubjectKey =
  | "pdp_named" | "pdp_generic"
  | "shop_all" | "shop_category"
  | "weddings" | "events"
  | "checkout"
  | "default";

type Override =
  | { kind: "pdp"; productName: string }
  | { kind: "shop"; category: string }
  | null;

export function getSubjectKey(input: {
  pathname: string;
  locale: "en" | "es";
  override: Override;
}): { key: SubjectKey; vars?: Record<string, string> };
```

Match order:
1. If `override.kind === "pdp"` → `pdp_named` with `{ product: override.productName }`.
2. If `override.kind === "shop"` → `shop_category` with `{ category: override.category }`.
3. Strip locale prefix from `pathname`.
4. If matches `/product/...` → `pdp_generic`.
5. If matches `/shop` exactly → `shop_all`.
6. If matches `/shop/...` (no override) → `shop_all` (we don't know the category name reliably without override).
7. `/weddings` → `weddings`. `/events` → `events`. `/cart` or `/checkout` → `checkout`.
8. Anything else → `default`.

The trigger uses the **same allowlist** as `getSubjectKey` to decide visibility — if `getSubjectKey` returns `default`, the trigger renders nothing on that route.

## i18n

### `messages/en.json` — `text_modal` namespace

```json
{
  "text_modal": {
    "trigger": "Text Maky",
    "title": "Text Maky",
    "subtitle": "I'll respond as soon as I can.",
    "preview_label": "Your message",
    "send_sms": "Send via SMS",
    "send_whatsapp": "WhatsApp",
    "call": "Call instead",
    "footer_note": "Mon–Sun · A real person",
    "inline_link": "Text Maky directly →",
    "greeting": "Hi Maky, ",
    "subjects": {
      "pdp_generic":   "I have a question about a product I'm looking at.",
      "pdp_named":     "I have a question about {product}.",
      "shop_all":      "I'm browsing your shop and have a question.",
      "shop_category": "I'm browsing your {category} collection and have a question.",
      "weddings":      "I'd like to inquire about wedding florals.",
      "events":        "I'd like to ask about florals for an event.",
      "checkout":      "I need help completing my order.",
      "default":       "I have a quick question."
    }
  }
}
```

### `messages/es.json` — `text_modal` namespace

```json
{
  "text_modal": {
    "trigger": "Escríbele a Maky",
    "title": "Escríbele a Maky",
    "subtitle": "Te responderé lo antes posible.",
    "preview_label": "Tu mensaje",
    "send_sms": "Enviar por SMS",
    "send_whatsapp": "WhatsApp",
    "call": "Llamar mejor",
    "footer_note": "Lun–Dom · Una persona real",
    "inline_link": "Escríbele a Maky directamente →",
    "greeting": "Hola Maky, ",
    "subjects": {
      "pdp_generic":   "tengo una pregunta sobre un producto que estoy viendo.",
      "pdp_named":     "tengo una pregunta sobre {product}.",
      "shop_all":      "estoy viendo tu tienda y tengo una pregunta.",
      "shop_category": "estoy viendo tu colección de {category} y tengo una pregunta.",
      "weddings":      "me gustaría consultar sobre flores para una boda.",
      "events":        "me gustaría consultar sobre flores para un evento.",
      "checkout":      "necesito ayuda para completar mi pedido.",
      "default":       "tengo una pregunta rápida."
    }
  }
}
```

(Spanish subjects are lowercase first-word because the Spanish greeting `"Hola Maky, "` ends with a comma + space, making the next word a continuation.)

## Visual Design

### Floating trigger (`TextMakyTrigger`)

- Position: `fixed bottom-6 right-6 z-30`
- Shape: pill, `bg-ink text-bone`, `px-5 py-3`, `rounded-full` (or arch-top variant if it reads better against the brand system — pick whichever feels closer to the existing buttons after a quick A/B in dev).
- Content: lucide `MessageCircle` icon (16px) + label from `t("text_modal.trigger")`.
- Shadow: `var(--shadow-diffusion)`.
- Entrance: framer-motion fade + 8px slide-up on mount, with `prefers-reduced-motion` respected.
- Hover: `bg-rouge` (matches primary button hover language).
- Focus ring: same `focus-visible:ring-rouge` pattern as `Button`.
- Visibility: only renders when `getSubjectKey` returns a non-`default` key (i.e. an allowlisted route).

### Modal (`TextMakyModal`)

Uses Radix `Dialog.Root` / `Portal` / `Overlay` / `Content` directly. The `Content` element switches layout via Tailwind classes:

- **Mobile** (`< md`): `fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--radius-bento)] p-8 border-t border-ink/10`. Spring slide-up animation matching the existing Sheet bottom variant.
- **Desktop** (`md:`): `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(28rem,calc(100vw-3rem))] rounded-[var(--radius-bento)] p-8`. Fade + scale 0.96 → 1 entrance.

Overlay is identical in both: `fixed inset-0 z-50 bg-ink/30 backdrop-blur-md`.

### Modal contents (top → bottom)

1. **Header row**
   - Left: `Dialog.Title` — display serif, `text-2xl text-ink`, `t("text_modal.title")`.
   - Right: close button (`Dialog.Close`), ghost variant, lucide `X` icon.
2. **Subtitle** — `Dialog.Description`, `text-ink/60 text-sm`, `t("text_modal.subtitle")`.
3. **Message preview**
   - Wrapper: `mt-6 bg-ink/[0.03] border border-ink/10 rounded-xl p-4`, `role="region"`, `aria-label={t("text_modal.preview_label")}`.
   - Mono label "Your message" — `font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50`.
   - Body — italic, serif-ish, `text-ink/80 text-[15px] leading-relaxed mt-1.5`. Read-only text node.
4. **Channel CTAs** — stacked column with `gap-2 mt-6`.
   - `<Button asChild variant="primary" size="md" className="w-full justify-center">`
     `<a href={smsHref}>` icon `MessageCircle` + `t("text_modal.send_sms")` `</a>` `</Button>`
   - WhatsApp: `Button` `variant="outline"` wrapping `<a href={whatsappHref} target="_blank" rel="noopener">`. Icon: simple inline SVG (avoid pulling in a new icon library; the WhatsApp glyph is a single path).
   - Call: `Button` `variant="ghost"` wrapping `<a href={telHref}>`. Icon: lucide `Phone`.
5. **Footer note** — centered, `mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40`, `t("text_modal.footer_note")`.

### Inline link (`TextMakyInlineLink`)

- Renders a `<button>` styled like an anchor: `font-mono text-[13px] hover:text-petal underline-offset-4 hover:underline transition-colors`.
- On click: opens the same modal. Implementation: `TextMakyInlineLink` accepts no props and includes its own `Dialog.Root` instance — the modal is duplicated per inline link instance, which is fine because only one will be open at a time and Radix handles focus correctly.
- Footer placement: replace the existing static phone anchor's parent block? No — keep the existing phone link (business line) and **add** the inline link below it as a subtler "or text directly" option.

## Edge Cases

- **Pathname not in allowlist** — trigger doesn't render. Inline link in footer always works (uses `subjects.default`).
- **PDP without override** — falls back to `pdp_generic`. This happens if a future PDP forgets to mount the subject-setter; safe default rather than crash.
- **Cart drawer open** — the Sheet overlay is `z-50`, the trigger is `z-30`, so the trigger is correctly hidden behind the overlay while the cart is open. No special handling needed.
- **Desktop without an SMS app** — `sms:` link may do nothing. WhatsApp opens `web.whatsapp.com` and `tel:` opens FaceTime / system dialer; both are reasonable fallbacks.
- **`encodeURIComponent` of the message** — required for spaces, the comma after "Hi Maky", and any future product names with apostrophes.
- **Cross-platform `sms:` body** — iOS uses `sms:NUMBER&body=...`, Android uses `sms:NUMBER?body=...`. The pattern `sms:NUMBER?&body=...` works on both.
- **`wa.me` URL** — must not include the leading `+` in the number.

## Accessibility

- Radix Dialog provides: focus trap, Escape-to-close, focus return to trigger on close, `role="dialog"`, `aria-modal="true"`.
- Floating trigger: `aria-label={t("text_modal.trigger")}`, `aria-haspopup="dialog"`, `aria-expanded` toggled with the open state.
- Each CTA inside the modal has an `aria-label` that includes the destination, e.g. `aria-label={`${t("text_modal.send_sms")} (+1 516-851-2815)`}`.
- Message preview: wrapper `role="region"` with `aria-label={t("text_modal.preview_label")}`.
- Animations gated on `prefers-reduced-motion: reduce` via framer-motion's built-in support (or a `MotionConfig reducedMotion="user"` wrapper at app root if not already present).

## Testing

### Unit tests (Vitest, in `tests/unit/`)

**`tests/unit/contact-subject.spec.ts`** — table tests for `getSubjectKey`:

| pathname | locale | override | expected key | expected vars |
|---|---|---|---|---|
| `/en/product/garden-bloom` | en | `{kind:"pdp",productName:"Garden Bloom"}` | `pdp_named` | `{product:"Garden Bloom"}` |
| `/en/product/garden-bloom` | en | `null` | `pdp_generic` | `undefined` |
| `/es/shop` | es | `null` | `shop_all` | `undefined` |
| `/es/shop/bouquets` | es | `{kind:"shop",category:"Ramos"}` | `shop_category` | `{category:"Ramos"}` |
| `/es/shop/bouquets` | es | `null` | `shop_all` | `undefined` |
| `/en/weddings` | en | `null` | `weddings` | `undefined` |
| `/en/events` | en | `null` | `events` | `undefined` |
| `/en/cart` | en | `null` | `checkout` | `undefined` |
| `/en/checkout` | en | `null` | `checkout` | `undefined` |
| `/en/journal` | en | `null` | `default` | `undefined` |
| `/en/story` | en | `null` | `default` | `undefined` |
| `/en` | en | `null` | `default` | `undefined` |

**`tests/unit/text-maky-links.spec.ts`** — pure URL builders:

- `buildSmsHref("+15168512815", "Hi Maky, I have a question about Garden Bloom.")` → exactly `sms:+15168512815?&body=Hi%20Maky%2C%20I%20have%20a%20question%20about%20Garden%20Bloom.`
- `buildWhatsappHref("+15168512815", msg)` → starts with `https://wa.me/15168512815?text=` (note: no `+`).
- `buildTelHref("+15168512815")` → `tel:+15168512815`.

**`tests/unit/text-maky-modal.spec.tsx`** — render tests:

- Renders with EN translations and a PDP override → preview shows `Hi Maky, I have a question about Garden Bloom.`
- Renders with ES translations and same override → preview shows `Hola Maky, tengo una pregunta sobre Garden Bloom.`
- Each CTA's anchor `href` matches the expected built link.
- Pressing Escape closes the modal (relies on Radix; one smoke test is enough).

### Manual checks before merging

- Open dev server, click trigger on PDP → SMS app opens with body in the right language.
- WhatsApp link opens correctly on mobile and `web.whatsapp.com` on desktop.
- Call link opens dialer / FaceTime.
- Trigger does NOT render on home, story, journal, legal, account, contact, order/confirmation.
- Footer inline link opens the modal on every page.
- VoiceOver on iOS: trigger announces correctly, modal traps focus.

## Open Questions

None at design time. The `phoneMobile` / `mobile` shape in `data/site.ts` is the only naming choice that could go either way; spec uses `mobile` for clarity against the existing `phone` field.

## Out of Scope (future work)

- Analytics: a single TODO comment near the channel handlers will mark the spot.
- A "request a callback" form variant.
- Business-hours-aware copy that says "I'm closed, leave a text and I'll get back" outside `SITE.hours`.
