# Cart Carries the Card Message From PDP to Checkout

**Date:** 2026-05-07
**Status:** Approved, ready for implementation plan
**Scope:** Fix to data flow PDP → cart → checkout for the card-message field

## Problem

A pre-existing bug, made more visible by the new AI assist. On the PDP, the customer types or picks a card message in the [CardMessage textarea](components/product/CardMessage.tsx). That value lives only in `PdpConfigurator`'s local React state and is never threaded into the cart. When the customer hits "Add to bag", [AddToBag.tsx:34](components/product/AddToBag.tsx#L34) calls:

```ts
add({ productId, variantId, addOnIds, qty: 1 });
```

There is no `cardMessage` field on the `CartLine` type ([cart-store.ts:4–9](lib/cart-store.ts#L4-L9)), so the message is silently dropped. At checkout, [CheckoutShell.tsx:100](components/checkout/CheckoutShell.tsx#L100) initializes `cardMessage: ""` from form defaults, so the customer is asked to type the message again.

The PDP textarea has been visually present but functionally decorative since the feature was built. Every customer who used it lost their message when navigating to checkout.

## Goal

The card message typed (or picked from the AI assist) on the PDP travels to the checkout's `delivery.cardMessage` / `pickup.cardMessage` form field, where the customer can still edit it. No data loss across navigation. No new UI.

## Non-goals

- No change to the per-line cart structure. The order schema treats `cardMessage` as a single field on `delivery` or `pickup` ([schemas/checkout.ts:40–54](schemas/checkout.ts#L40-L54)), so a single cart-level field matches the domain model.
- No mid-checkout reset behavior. Customer edits at checkout win.
- No analytics changes beyond what already tracks `cardMessage.trim().length > 0` at the checkout step.
- No subscription-form changes — `SubscriptionInquiryForm` uses its own form state and is out of scope.
- No tests for the `local-print-agent-wip` work in the worktree — that's an unrelated parallel session's WIP.

## Design

### Architecture: cart-level field

The cart store gains a top-level `cardMessage: string` field plus a `setCardMessage(s: string)` action. Persists via the existing zustand `persist` middleware. `clear()` also blanks the message.

```ts
type CartState = {
  lines: CartLine[];
  cardMessage: string;
  add: (line: CartLine) => void;
  setCardMessage: (msg: string) => void;
  // ...existing actions, with clear() also resetting cardMessage to ""
};
```

### Data flow

```
PdpConfigurator (local message state)
   │
   │  passes cardMessage={message} prop
   ▼
AddToBag
   │  onClick:
   │    add({ productId, variantId, addOnIds, qty: 1 })
   │    if (cardMessage && cardMessage.trim()) setCardMessage(cardMessage)
   ▼
Cart store (persisted, includes cardMessage)
   │
   │  CheckoutShell mounts, reads cart's cardMessage
   ▼
Form defaultValues:
   delivery.cardMessage = cartCardMessage
   pickup.cardMessage   = cartCardMessage
```

### Semantics

- **Last write wins.** Adding a second product with a different non-empty message overwrites. Adding a second product with no message leaves the existing message intact (we only set when the new value is non-empty).
- **Editable at checkout.** The form field is rendered as a `<TextInput {...register("delivery.cardMessage")} />` (current behavior). The pre-population is purely the default value; customer can edit freely.
- **Persists across sessions.** The zustand `persist` middleware already covers the cart; the new field rides along.
- **`clear()` zeroes it.** After a successful checkout, when the cart is cleared, the message resets so the next session starts fresh.

### Edge cases

| Scenario | Behavior |
|---|---|
| Customer types on PDP A, adds A, then types nothing on PDP B and adds B | Cart still carries A's message. |
| Customer types on PDP A, adds A, then types a different message on PDP B and adds B | Cart now carries B's message. Last-write-wins. |
| Customer adds A without ever opening the card-message textarea | Cart's `cardMessage` stays empty (initial value `""`). Checkout pre-populates blank — same as today. No regression. |
| Customer adds to cart from PDP, then navigates away and returns later | Persisted message restored from localStorage. Cart bag drawer doesn't show it (out of scope), but checkout pre-populates it. |
| Successful checkout → cart cleared | `cardMessage` resets to `""`. Next session starts clean. |
| Customer manually edits the card message at checkout | Customer's edit wins (it's a normal form field). The cart's stored value is not updated — that's fine because the order is being placed right then. |

### Affected files

| File | Change |
|---|---|
| `lib/cart-store.ts` | Add `cardMessage: string`, `setCardMessage`, reset in `clear()`. |
| `components/product/AddToBag.tsx` | Accept optional `cardMessage?: string` prop. In `onClick`, after `add(...)`, if the new value is non-empty (`.trim().length > 0`), call `setCardMessage(cardMessage)`. |
| `components/product/PdpConfigurator.tsx` | Pass `cardMessage={message}` to `<AddToBag />`. |
| `components/checkout/CheckoutShell.tsx` | Read `useCartStore((s) => s.cardMessage)` once at mount, use as default for both `delivery.cardMessage` and `pickup.cardMessage` in the form's `defaultValues`. |

### Tests

| Test | What it pins |
|---|---|
| `tests/unit/cart-store.test.ts` (new or extend) | `setCardMessage` updates the field; `add` does not change `cardMessage`; `clear` resets it; `persist` round-trip preserves it. |
| `tests/unit/AddToBag.test.tsx` (extend or new) | Clicking "Add to bag" with a non-empty `cardMessage` calls `setCardMessage` with that value; with an empty/whitespace value, does NOT call `setCardMessage`. |
| `tests/unit/CheckoutShell.test.tsx` (extend or new) | When the cart store has a `cardMessage`, the `delivery.cardMessage` field's default value is that string; otherwise it's `""`. |

### Out of scope

- No display of the carried message in the cart drawer / cart summary.
- No "edit on the PDP" affordance after add-to-bag.
- No multi-item, multi-message workflows.
- No back-fill for existing browser sessions whose `diva-cart` localStorage entry pre-dates the new field — zustand's `persist` simply treats missing fields as the initial value (empty string), which is correct.

## Risks

- **Persist migration.** The `persist` middleware will load old localStorage entries that have no `cardMessage` key. With zustand v4+ defaults the missing field is treated as `undefined`. We initialize `cardMessage: ""` in the store creator, so the merged state will end up with the initial value when the persisted data has no entry. Verify with a test that calls `useCartStore.persist.rehydrate()` against a pre-existing JSON.
- **Race with cart drawer.** `AddToBag.onClick` opens the cart drawer (`openDrawer()`). The `setCardMessage` call should happen before that — order matters only if a future drawer renders the message. For now there is no such render, so order is cosmetic.
- **Persistence vs privacy.** The message lives in localStorage. If two users share a browser, the second user could see the first user's persisted message at checkout. This was already true for cart lines; treating the card message the same way is consistent. Document but don't engineer around.
- **Pre-existing bug ≠ regression risk.** Existing tests for AddToBag and the cart should continue to pass; the new behavior is purely additive. The new tests are what locks the fix in.
