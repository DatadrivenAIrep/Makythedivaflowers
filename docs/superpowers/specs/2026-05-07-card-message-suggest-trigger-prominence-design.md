# Card Message — More Noticeable "Suggest Message" Trigger

**Date:** 2026-05-07
**Status:** Approved, ready for implementation plan
**Scope:** Single-component visual update on the PDP

## Problem

The card-message AI assist feature already works on product detail pages, but customers are missing it. The trigger is rendered as a muted text link (`font-mono text-xs text-mute-500`) below the textarea, indistinguishable from a footnote. Customers who would benefit from the assist (don't know what to write on the card) never discover it exists.

## Goal

Make the trigger unmistakably interactive without making it dominate the form. Increase discoverability of the feature; do not change its placement, behavior, or the panel that opens.

## Non-goals

- No changes to `CardMessageAssist` (the panel that opens after clicking).
- No changes to `/api/card-message` or the prompt logic.
- No auto-open on first visit — too pushy on every PDP view.
- No banner above the textarea — adds visual weight to every PDP.
- No moving the trigger out of `CardMessage.tsx`.
- No changes to the subscription form's reuse of `CardMessageAssist`.

## Design

### Affected file
- `components/product/CardMessage.tsx` only (lines ~80–93 — the trigger row).
- i18n strings in `messages/en.json` and `messages/es.json` under `card_message_assist.trigger` (and only the non-sympathy variant).

### Visual change

The trigger button changes from a small muted text link into a **bordered pill button** that sits on its own row directly below the textarea.

**Closed state (assist panel hidden):**
```
rounded-full border border-ink/30 px-3.5 py-1.5
font-sans text-sm text-ink
hover:border-ink hover:bg-ink/5
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge
transition-colors
```

**Open state (assist panel visible):**
```
rounded-full border border-ink bg-ink text-bone px-3.5 py-1.5
font-sans text-sm
hover:bg-ink/90
```

The filled state communicates "this control is engaged"; clicking again closes the panel. `aria-expanded` continues to reflect open state for screen readers.

The leading `✨` sparkle is kept inline as part of the label string (already done today via `triggerPrefix`).

### Layout change

Today the trigger and the `123/200` character counter share a single `flex justify-between` row. The pill is wider than the old text link, so the row gets restructured into two stacked rows:

1. **Pill row** (immediately below textarea, left-aligned) — the trigger pill.
2. **Counter row** (below the pill, right-aligned) — the `123/200` indicator.

Pill goes first because we want it within easy eye-line of the textarea; the counter is secondary feedback and is fine slightly further down. Each element owns a full row, so nothing wraps awkwardly on narrow viewports.

Vertical space added: ~24 px. Acceptable within the existing PDP form rhythm.

### Copy change

The current copy `Suggest message` / `Sugerir mensaje` is functional but doesn't communicate value. Update the non-sympathy variant only.

| Key                                            | Before              | After                                  |
| ---------------------------------------------- | ------------------- | -------------------------------------- |
| `card_message_assist.trigger` (en)             | `Suggest message`   | `Need ideas? Suggest a message`        |
| `card_message_assist.trigger` (es)             | `Sugerir mensaje`   | `¿Necesitas ideas? Sugerir mensaje`    |
| `card_message_assist.trigger_sympathy` (en/es) | unchanged           | unchanged                              |

The sparkle `✨` is prepended at render time (existing `triggerPrefix` logic) and is **only added in the non-sympathy variant**. Sympathy stays bare and reserved.

## Behavior (unchanged)

- Click toggles `open`; the panel renders above the textarea.
- `onPick` writes the chosen suggestion into the textarea (truncated to `maxLength`) and closes the panel.
- `aria-expanded={open}` stays on the trigger.

## Accessibility

- Pill remains a `<button type="button">` with the visible label as its accessible name.
- Hit target ≥ 36 px tall (current `py-1.5` + `text-sm` reaches this with the pill border included).
- Visible focus ring uses `ring-rouge` (matches the suggestions list focus ring inside the panel — consistent with `CardMessageAssist.tsx:143`).
- Color contrast: closed state is `text-ink` on `bone` background — passes AA. Open state is `text-bone` on `bg-ink` — passes AA.

## Testing

Manual verification on the PDP:
1. **Discoverability** — Trigger is visibly a button, not a link. Sparkle and copy are legible.
2. **Toggle** — Click opens the panel; pill switches to filled state. Click again closes; pill returns to outlined.
3. **Mobile** — Pill, counter, and textarea stack cleanly on a 375 px viewport. No horizontal scroll, no awkward wrapping.
4. **Sympathy SKU** — On a sympathy product, the trigger reads `Suggest message` / `Sugerir mensaje` with no sparkle and no "need ideas" framing.
5. **Locale** — Spanish copy renders without truncation in the pill.
6. **Keyboard** — Tab into the pill; focus ring shows. Enter / Space toggles.

No automated test changes required — this is a visual update on an already-tested component. Existing unit tests for `CardMessage` (if any) continue to pass because the toggle contract is unchanged.

## Risks

- **Visual weight on the PDP** — The pill is more prominent than today, by intent. If it ends up looking like the primary "Add to cart" button, we'll dial down with `border-ink/20` instead of `border-ink/30`. Easy to tune post-merge.
- **i18n string change** — Translators of any future locales need to know this is a CTA, not a label. Already handled by JSON keys.
