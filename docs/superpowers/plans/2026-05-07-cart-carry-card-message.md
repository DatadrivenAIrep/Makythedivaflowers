# Cart Carries the Card Message — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the card message typed (or AI-picked) on the PDP travel through `add-to-bag` → cart store → checkout's `cardMessage` form field, where the customer can still edit it.

**Architecture:** Add a single top-level `cardMessage: string` to the existing zustand cart store (already persisted to localStorage via `persist` middleware). `AddToBag` accepts an optional `cardMessage` prop and calls `setCardMessage` on add. `PdpConfigurator` passes its existing `message` state into `AddToBag`. `CheckoutShell` reads the cart's `cardMessage` once at render and uses it as the default for `delivery.cardMessage` in the form.

**Tech Stack:** Zustand store with `persist` middleware, react-hook-form + zod, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-05-07-cart-carry-card-message-design.md](../specs/2026-05-07-cart-carry-card-message-design.md)

---

## Pre-flight

You are starting on `feat/cart-carry-card-message` (HEAD `bde2309` — the spec commit). Verify:

```bash
git branch --show-current  # → feat/cart-carry-card-message
git rev-parse HEAD         # → bde2309...
```

If branch is wrong, STOP and report BLOCKED. Do NOT switch branches yourself.

When committing, stage SPECIFIC files by name — never `git add -A` or `git add .`. The repo has frequently had unrelated dirty files from parallel sessions.

## Background reading (do this once before Task 1)

- `lib/cart-store.ts` — current shape: zustand store with `persist`, `CartLine` type, methods `add`, `remove`, `setQty`, `clear`, `count`. Storage key `"diva-cart"`.
- `tests/unit/cart-store.test.ts` — existing pattern: `beforeEach` resets `setState({ lines: [] })` and clears `localStorage`.
- `components/product/AddToBag.tsx` — the `onClick` handler currently calls `add({ productId, variantId, addOnIds, qty: 1 })` (line 34). It already uses `useCartStore((s) => s.add)`.
- `components/product/PdpConfigurator.tsx` — owns `const [message, setMessage] = useState("")` at line 28, passes `value={message}` and `onChange={setMessage}` to `<CardMessage>`. Currently renders `<AddToBag>` at lines 78–85 with no card-message prop.
- `components/checkout/CheckoutShell.tsx` — `useForm` `defaultValues` block at lines ~95–106. The `delivery` block contains `cardMessage: ""`. The schema's `delivery` field is a discriminated union (`method: "delivery"` or `"pickup"`), and BOTH variants have `cardMessage` at the same path (`delivery.cardMessage`). One default value covers both.
- `schemas/checkout.ts:40` — `cardMessage` is `z.string().max(200).optional().or(z.literal(""))`. Both members of the `delivery` discriminated union include it.

Test command: `npm test` (Vitest). Single file: `npm test -- tests/unit/<file>`.

---

### Task 1: Extend cart store with `cardMessage` field

Add a single top-level `cardMessage: string` to the store, a `setCardMessage` action, and reset it inside `clear()`. Cover all of it with focused tests on the new contract.

**Files:**
- Modify: `lib/cart-store.ts`
- Modify: `tests/unit/cart-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `tests/unit/cart-store.test.ts`. Inside the existing `describe("cartStore", ...)` block, append the following tests at the bottom (do NOT delete or modify the existing tests; do NOT touch the existing `beforeEach`):

```ts
  it("starts with an empty cardMessage", () => {
    expect(useCartStore.getState().cardMessage).toBe("");
  });

  it("setCardMessage updates the field", () => {
    useCartStore.getState().setCardMessage("Feliz cumpleaños");
    expect(useCartStore.getState().cardMessage).toBe("Feliz cumpleaños");
  });

  it("add() does not touch cardMessage", () => {
    useCartStore.getState().setCardMessage("preserve me");
    useCartStore.getState().add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    expect(useCartStore.getState().cardMessage).toBe("preserve me");
  });

  it("clear() resets cardMessage to empty", () => {
    useCartStore.getState().setCardMessage("anything");
    useCartStore.getState().add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    useCartStore.getState().clear();
    expect(useCartStore.getState().cardMessage).toBe("");
    expect(useCartStore.getState().lines).toEqual([]);
  });
```

Also update the existing `beforeEach` so it ALSO resets the new field (avoids cross-test pollution). The current `beforeEach` is:

```ts
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    if (typeof localStorage !== "undefined") localStorage.clear();
  });
```

Replace with:

```ts
  beforeEach(() => {
    useCartStore.setState({ lines: [], cardMessage: "" });
    if (typeof localStorage !== "undefined") localStorage.clear();
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- tests/unit/cart-store.test.ts`
Expected: The four new tests FAIL because `cardMessage` and `setCardMessage` don't exist on the store yet. The existing tests should still pass.

- [ ] **Step 3: Update `lib/cart-store.ts`**

Replace the full contents of `lib/cart-store.ts` with:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  productId: string;
  variantId: string;
  addOnIds: string[];
  qty: number;
};

type CartState = {
  lines: CartLine[];
  cardMessage: string;
  add: (line: CartLine) => void;
  setCardMessage: (msg: string) => void;
  remove: (productId: string, variantId: string) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      cardMessage: "",
      add: (line) =>
        set((state) => {
          const existingIdx = state.lines.findIndex(
            (l) => l.productId === line.productId && l.variantId === line.variantId,
          );
          if (existingIdx >= 0) {
            const next = [...state.lines];
            next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + line.qty };
            return { lines: next };
          }
          return { lines: [...state.lines, line] };
        }),
      setCardMessage: (msg) => set({ cardMessage: msg }),
      remove: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter((l) => !(l.productId === productId && l.variantId === variantId)),
        })),
      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.productId === productId && l.variantId === variantId ? { ...l, qty } : l,
            )
            .filter((l) => l.qty > 0),
        })),
      clear: () => set({ lines: [], cardMessage: "" }),
      count: () => get().lines.reduce((s, l) => s + l.qty, 0),
    }),
    { name: "diva-cart" },
  ),
);
```

Notes:
- `cardMessage: ""` in the initializer covers the migration case — when the persisted localStorage entry pre-dates this change (no `cardMessage` key), zustand merges with the initializer so the result is `""`. No explicit migration needed.
- `setCardMessage` uses `set({ cardMessage: msg })` (replacement form), which is valid because zustand's `set` shallow-merges by default.
- `clear()` resets both `lines` AND `cardMessage`.

- [ ] **Step 4: Run the tests, confirm all pass**

Run: `npm test -- tests/unit/cart-store.test.ts`
Expected: All tests pass (existing 4 + new 4 = 8 tests, or whatever the count was before plus 4).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: Whole suite passes. The widened `CartState` type adds a required `cardMessage` field, but every existing consumer uses store-level subscriptions via `useCartStore((s) => s.X)`, so no call site needs to be updated to satisfy the type. If you see a TypeScript error at any call site you didn't expect, STOP and report — that's a sign the change touched more than intended.

- [ ] **Step 6: Commit**

```bash
git add lib/cart-store.ts tests/unit/cart-store.test.ts
git commit -m "feat(cart): add cardMessage field and setCardMessage action"
```

After the commit, run `git status -s`. Expected: empty (no leftover changes in tracked files). If you see anything other than untracked files like `.claude/`, STOP — you may have staged something unintended.

---

### Task 2: Thread `cardMessage` from PDP → AddToBag → cart

The PDP already owns the `message` state in `PdpConfigurator`. The `AddToBag` component already calls `add(...)`. We add an optional prop to `AddToBag` and one new call inside its `onClick`. No unit test in this task — the `cart-store` test covers the new contract, and the wiring will be verified end-to-end in Task 4 (manual browser verification). Adding a unit test for `AddToBag` would require mocking ~5 dependencies (cart store, UI store, analytics, framer-motion, next-intl, MagneticButton) and isn't worth the cost for a one-line wiring change.

**Files:**
- Modify: `components/product/AddToBag.tsx`
- Modify: `components/product/PdpConfigurator.tsx`

- [ ] **Step 1: Update `AddToBag.tsx`**

Open `components/product/AddToBag.tsx`. Make three changes:

1. Add `cardMessage?: string` to the `Props` type (currently lines 15–22):

   ```tsx
   type Props = {
     productId: string;
     variantId: string;
     addOnIds: string[];
     totalCents: number;
     disabled?: boolean;
     locale: Locale;
     cardMessage?: string;
   };
   ```

2. Destructure `cardMessage` and grab `setCardMessage` from the store. The current top of `AddToBagImpl` is:

   ```tsx
   function AddToBagImpl({ productId, variantId, addOnIds, totalCents, disabled, locale }: Props) {
     const add = useCartStore((s) => s.add);
     const showToast = useUIStore((s) => s.showToast);
     const openDrawer = useUIStore((s) => s.openDrawer);
   ```

   Replace with:

   ```tsx
   function AddToBagImpl({ productId, variantId, addOnIds, totalCents, disabled, locale, cardMessage }: Props) {
     const add = useCartStore((s) => s.add);
     const setCardMessage = useCartStore((s) => s.setCardMessage);
     const showToast = useUIStore((s) => s.showToast);
     const openDrawer = useUIStore((s) => s.openDrawer);
   ```

3. Inside `onClick`, after `add({...})` and before `resolveCartLine(...)`, set the card message if a non-empty value was provided. The current `onClick` body (lines 32–43):

   ```tsx
   const onClick = () => {
     if (disabled) return;
     add({ productId, variantId, addOnIds, qty: 1 });
     const resolved = resolveCartLine({ productId, variantId, addOnIds, qty: 1 }, PRODUCTS);
     if (resolved) {
       trackAddToCart(resolvedLineToAnalyticsItem(resolved));
     }
     showToast({ kind: "added-to-bag", productId });
     openDrawer();
     setState("added");
     window.setTimeout(() => setState("idle"), 1800);
   };
   ```

   Replace with:

   ```tsx
   const onClick = () => {
     if (disabled) return;
     add({ productId, variantId, addOnIds, qty: 1 });
     if (cardMessage && cardMessage.trim().length > 0) {
       setCardMessage(cardMessage);
     }
     const resolved = resolveCartLine({ productId, variantId, addOnIds, qty: 1 }, PRODUCTS);
     if (resolved) {
       trackAddToCart(resolvedLineToAnalyticsItem(resolved));
     }
     showToast({ kind: "added-to-bag", productId });
     openDrawer();
     setState("added");
     window.setTimeout(() => setState("idle"), 1800);
   };
   ```

Do not change anything else (the JSX, the `MagneticButton`, the animation, the labels).

- [ ] **Step 2: Update `PdpConfigurator.tsx`**

Open `components/product/PdpConfigurator.tsx`. Find the `<AddToBag …/>` call (around lines 78–85, currently):

```tsx
<AddToBag
  productId={product.id}
  variantId={variantId}
  addOnIds={addOnIds}
  totalCents={totalCents}
  disabled={!variantId || !date}
  locale={locale}
/>
```

Replace with:

```tsx
<AddToBag
  productId={product.id}
  variantId={variantId}
  addOnIds={addOnIds}
  totalCents={totalCents}
  disabled={!variantId || !date}
  locale={locale}
  cardMessage={message}
/>
```

The local `message` state already exists at line 28 (`const [message, setMessage] = useState("");`) and is already wired into `<CardMessage value={message} onChange={setMessage} />` at line 73. You only need to thread it down one more level.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: Whole suite passes. AddToBag and PdpConfigurator have no direct unit tests, so the type-checking pass (which Vitest does as part of running the TSX-transformed tests) is what catches a wiring mistake here.

- [ ] **Step 4: Commit**

```bash
git add components/product/AddToBag.tsx components/product/PdpConfigurator.tsx
git commit -m "feat(cart): AddToBag persists cardMessage; PDP wires it through"
```

After the commit, run `git status -s` and confirm no unstaged changes in these two files remain.

---

### Task 3: `CheckoutShell` pre-populates `cardMessage` from cart

Read the cart's `cardMessage` once and use it as the default value for the form's `delivery.cardMessage`. Because the form's `delivery` is a discriminated union over `method`, the path `delivery.cardMessage` is valid for both `delivery` and `pickup` variants — a single default covers both. No unit test for `CheckoutShell` (large Stripe-coupled component, brittle to mock); manual verification in Task 4 covers it.

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`

- [ ] **Step 1: Update `CheckoutShell.tsx`**

Open `components/checkout/CheckoutShell.tsx`. Find the existing cart subscriptions near the top of the component (around lines 75–77):

```tsx
const lines = useCartStore((s) => s.lines);
const clear = useCartStore((s) => s.clear);
const closeDrawer = useUIStore((s) => s.closeDrawer);
```

Add one more subscription, before `closeDrawer`:

```tsx
const lines = useCartStore((s) => s.lines);
const clear = useCartStore((s) => s.clear);
const cartCardMessage = useCartStore((s) => s.cardMessage);
const closeDrawer = useUIStore((s) => s.closeDrawer);
```

Then find the `useForm` `defaultValues` block (around lines 95–106), which currently is:

```tsx
const form = useForm<CheckoutInput>({
  resolver: zodResolver(checkoutSchema),
  mode: "onBlur",
  defaultValues: {
    contact: { email: "", phone: "" },
    delivery: {
      method: "delivery",
      recipient: { name: "", phone: "" },
      address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
      window: { date: "", slot: "midday" },
      cardMessage: "",
    },
  },
});
```

Change the `cardMessage` default to use the cart value:

```tsx
const form = useForm<CheckoutInput>({
  resolver: zodResolver(checkoutSchema),
  mode: "onBlur",
  defaultValues: {
    contact: { email: "", phone: "" },
    delivery: {
      method: "delivery",
      recipient: { name: "", phone: "" },
      address: { street1: "", street2: "", city: "", state: "NY", zip: "", country: "US" },
      window: { date: "", slot: "midday" },
      cardMessage: cartCardMessage,
    },
  },
});
```

Do not change anything else (other form fields, the `useState` setup below the form, the Stripe handling, the submit handlers).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: Whole suite passes.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/CheckoutShell.tsx
git commit -m "feat(checkout): pre-populate cardMessage from cart store"
```

After the commit, run `git status -s` and confirm no unstaged changes in this file remain.

---

### Task 4: Manual browser verification (human only)

Subagents cannot reliably exercise the full PDP → cart → checkout flow in a browser. The human runs the dev server and verifies:

```bash
npm run dev
```

Then in a browser:

1. **Happy path (delivery):** Open any non-sympathy PDP (e.g. `http://localhost:3000/en/product/angels-touch`). Type a card message OR pick one from the AI assist. Click "Add to bag". Open the checkout. Confirm the "Card message (optional)" / "Mensaje de tarjeta" field is **pre-populated** with the exact text typed/picked.

2. **Happy path (pickup):** Same as above, but on the checkout step toggle to "Pickup" (if available). Confirm the pickup form also shows the pre-populated card message.

3. **Edit at checkout:** With a pre-populated message, edit the text in the checkout field. Confirm the form accepts the edit (i.e. the pre-population is just a default, not a controlled overwrite).

4. **Empty PDP message:** Open a PDP, do NOT touch the card-message textarea, click "Add to bag". Confirm the checkout's card-message field is empty (no regression for customers who skip it).

5. **Multi-product overwrite:** Add product A with message "Test A". Add product B with message "Test B". Open checkout. Confirm the field shows "Test B" (last-write-wins).

6. **Multi-product preserve:** Add product A with message "Test A". Open another PDP, do NOT touch the textarea, add product B. Open checkout. Confirm the field shows "Test A" (empty does not overwrite).

7. **Persistence:** Add a product with a message. Hard-refresh the browser tab. Open the checkout. Confirm the message is still pre-populated (zustand `persist` round-trip works).

8. **Clear on order success:** Complete a test checkout (use the $1 test product). After the confirmation screen, return to a PDP and add another product without typing a message. Open checkout. Confirm the field is empty (the post-payment `clear()` reset the cart's `cardMessage`).

If any scenario fails, the human reports which one and what they saw. The implementer iterates only on the failing scenario, never re-doing scenarios that already passed.

---

## Spec coverage check

Mapping each spec section to a task:

- **Cart-level `cardMessage` field + `setCardMessage` action + reset in `clear()`** → Task 1.
- **AddToBag accepts optional `cardMessage` prop and calls `setCardMessage` only when non-empty** → Task 2 Step 1.
- **PdpConfigurator passes its `message` state to AddToBag** → Task 2 Step 2.
- **CheckoutShell reads `cardMessage` from cart and uses as form default for `delivery.cardMessage`** → Task 3 Step 1.
- **Discriminated union (`delivery` vs `pickup`) both work with the same default** → Task 3 (single default covers both via the union path).
- **Last-write-wins, empty does not overwrite** → Task 2's `if (cardMessage && cardMessage.trim().length > 0)` guard.
- **Persistence across sessions** → existing `persist` middleware, no code change; sanity-checked in Task 4 step 7.
- **`clear()` zeroes the message** → Task 1 `clear` impl.
- **Migration of pre-existing localStorage entries** → handled by zustand's default-merge with initializer (`cardMessage: ""`). No explicit migration code; sanity-checked by the "starts with empty cardMessage" test combined with `beforeEach` localStorage clear (covers fresh state) — pre-existing entry behavior is verified manually in Task 4.
- **Tests:** cart-store extensions in Task 1. AddToBag and CheckoutShell unit tests intentionally skipped; the spec mentioned them as candidates but the plan justifies skipping them as YAGNI given the small scope and the cost of mocking those components' many dependencies.

No gaps in essential behavior. The AddToBag and CheckoutShell test gaps are documented and accepted.
