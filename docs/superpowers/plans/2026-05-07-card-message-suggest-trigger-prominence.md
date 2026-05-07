# Card Message Suggest Trigger Prominence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the muted "Suggest message" text link inside `CardMessage` into a clearly-clickable bordered pill button with reworked copy, so PDP customers actually discover the AI card-message assist.

**Architecture:** Single client component restyle in `components/product/CardMessage.tsx`. Two stacked rows below the textarea: an outlined pill trigger that flips to a filled state when the assist panel is open, then a right-aligned character counter. i18n copy update for `card_message_assist.trigger` (en + es) only — sympathy variant stays untouched. No changes to `CardMessageAssist`, the API route, or the panel's behavior.

**Tech Stack:** Next.js (project-customized — see `node_modules/next/dist/docs/` if Next APIs are touched, but this change does not touch any), React client component, Tailwind, `next-intl`, Vitest + Testing Library for the regression test.

**Spec:** [docs/superpowers/specs/2026-05-07-card-message-suggest-trigger-prominence-design.md](../specs/2026-05-07-card-message-suggest-trigger-prominence-design.md)

---

## Background reading (do this once before Task 1)

Skim these so the changes below are unambiguous:

- `components/product/CardMessage.tsx` — the file we're modifying. The trigger row is at lines ~80–93.
- `components/product/CardMessageAssist.tsx` — referenced only to confirm we are NOT touching it, and to copy the focus-ring style (`focus-visible:ring-2 focus-visible:ring-rouge`) used at line 143.
- `tests/unit/CardMessage.test.tsx` — the existing tests. They mock `next-intl` so `useTranslations()(k)` returns the key itself; that's why tests query buttons by `name: /trigger/i`. Our changes preserve this contract.
- `messages/en.json` and `messages/es.json` — the `card_message_assist` block is at the very top of each file.

Test command for the whole repo: `npm test` (runs `vitest run`). Single-file: `npm test -- tests/unit/CardMessage.test.tsx`.

---

### Task 1: Lock in `aria-expanded` toggle contract with a regression test

The trigger already sets `aria-expanded={open}`. We're about to do a visual rewrite of that button. Pin the toggle behavior with a test first so we'd notice if a refactor accidentally drops the attribute or stops flipping it.

This test will pass *immediately* against the unmodified component — that's expected. The point is to lock the contract in place before Task 2 rewrites the JSX around it.

**Files:**
- Modify: `tests/unit/CardMessage.test.tsx` (append one new `it(...)` inside the existing `describe("CardMessage", ...)`)

- [ ] **Step 1: Add the regression test**

Open `tests/unit/CardMessage.test.tsx` and add this test inside the existing `describe("CardMessage", () => { ... })` block, after the last `it(...)` (currently the sympathy test at line 45):

```tsx
  it("toggles aria-expanded on the trigger when opening and closing the assist panel", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /trigger/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
```

- [ ] **Step 2: Run the new test and verify it passes**

Run: `npm test -- tests/unit/CardMessage.test.tsx`
Expected: All tests in the file pass, including the new "toggles aria-expanded" case. (It passes immediately because `aria-expanded={open}` already exists at line 84 of `CardMessage.tsx`. That's intentional — we're pinning a contract before Task 2 rewrites the JSX around it.)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/CardMessage.test.tsx
git commit -m "test(card-message): pin aria-expanded toggle on trigger"
```

---

### Task 2: Restyle trigger as pill, restructure layout, update i18n copy

Replace the muted text link with an outlined pill that flips to a filled state when open, stack pill above the counter on its own row, and swap the non-sympathy `trigger` copy in both locales.

**Files:**
- Modify: `components/product/CardMessage.tsx` (the bottom row at lines ~80–93)
- Modify: `messages/en.json` (`card_message_assist.trigger`)
- Modify: `messages/es.json` (`card_message_assist.trigger`)

- [ ] **Step 1: Update English copy**

Open `messages/en.json`. Find the `card_message_assist` block at the top of the file and change the value of the `trigger` key (leave `trigger_sympathy` alone):

```json
"card_message_assist": {
    "trigger": "Need ideas? Suggest a message",
    "trigger_sympathy": "Suggest message",
```

- [ ] **Step 2: Update Spanish copy**

Open `messages/es.json` and apply the same change to the `trigger` key (leave `trigger_sympathy` alone):

```json
"card_message_assist": {
    "trigger": "¿Necesitas ideas? Sugerir mensaje",
    "trigger_sympathy": "Sugerir mensaje",
```

- [ ] **Step 3: Replace the trigger row in `CardMessage.tsx`**

Open `components/product/CardMessage.tsx`. Replace the entire bottom block currently at lines ~80–93 (the `<div className="flex items-center justify-between">…</div>` wrapper and its two children — the toggle button and the character-count `<p>`). Use this exact replacement:

```tsx
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={
            open
              ? "self-start rounded-full border border-ink bg-ink px-3.5 py-1.5 font-sans text-sm text-bone transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
              : "self-start rounded-full border border-ink/30 px-3.5 py-1.5 font-sans text-sm text-ink transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
          }
        >
          {triggerPrefix}
          {triggerLabel}
        </button>
        <p className="self-end font-mono text-xs text-mute-500">
          {value.length}/{maxLength}
        </p>
      </div>
```

Notes for whoever applies this edit:
- The outer flex direction switches from horizontal (`flex items-center justify-between`) to vertical (`flex flex-col gap-1.5`) so the pill and counter occupy separate rows.
- `self-start` keeps the pill left-aligned without taking the full row width; `self-end` keeps the counter right-aligned.
- `triggerPrefix` and `triggerLabel` already exist as locals at lines 46–47 of the current file — do not redefine them.
- The conditional className keeps both class strings as full literal strings (not concatenated) so Tailwind's content-scanner picks them up reliably.

- [ ] **Step 4: Run the full unit test file and verify all tests still pass**

Run: `npm test -- tests/unit/CardMessage.test.tsx`
Expected: All five tests pass, including "renders the textarea and counter", "calls onChange when the user types", "shows the assist trigger by default", "opens the assist panel on trigger click", "uses sympathy chip set when occasions includes sympathy", and the new "toggles aria-expanded" test from Task 1.

If any test fails because the trigger button can no longer be found by `name: /trigger/i`: that means `triggerLabel` got accidentally removed from the JSX. Restore it.

- [ ] **Step 5: Run the full test suite for safety**

Run: `npm test`
Expected: Whole suite passes. We've only touched one component and two JSON files, so nothing else should be affected.

- [ ] **Step 6: Manual visual verification in the browser**

Start the dev server:

```bash
npm run dev
```

Open a non-sympathy product page (e.g. `http://localhost:3000/en/shop/<any-product-slug>` and `http://localhost:3000/es/shop/<same-slug>`). Verify each of the following:

1. **Closed state** — Below the card-message textarea, the trigger renders as a bordered pill with the sparkle and the new long copy ("✨ Need ideas? Suggest a message" in en, "✨ ¿Necesitas ideas? Sugerir mensaje" in es). The character counter sits on its own row below, right-aligned.
2. **Open state** — Click the pill. The assist panel renders above the textarea, AND the pill itself flips to filled (dark background, light text). Click again — pill returns to outlined, panel closes.
3. **Mobile (375 px viewport via devtools)** — Pill, counter, textarea all stack cleanly. No horizontal scroll. Long Spanish copy fits on one line inside the pill (or wraps gracefully — wrapping is acceptable, truncation is not).
4. **Sympathy product** — Open a sympathy product. The trigger shows `Suggest message` / `Sugerir mensaje` with NO sparkle and NO "need ideas" framing.
5. **Keyboard** — Tab to the pill. A visible rouge focus ring appears. Press Enter — panel toggles.

If any of the above fails, fix and re-verify before committing. Report exactly which step failed if you can't resolve it.

- [ ] **Step 7: Commit**

```bash
git add components/product/CardMessage.tsx messages/en.json messages/es.json
git commit -m "feat(card-message): make assist trigger a prominent pill button

Convert the muted text-link trigger below the card-message textarea
into a bordered pill that flips to a filled state when the assist
panel is open, and rework the non-sympathy copy to invite use.
Sympathy products keep their reserved label."
```

---

## Spec coverage check

Mapping each item from the spec to a task:

- Visual change (outlined pill closed, filled pill open) → Task 2 Step 3.
- Layout change (pill row + counter row, stacked) → Task 2 Step 3.
- Copy change `card_message_assist.trigger` (en + es) → Task 2 Steps 1–2.
- Sympathy variant unchanged → Task 2 Steps 1–2 explicitly leave `trigger_sympathy` untouched; verified in Task 2 Step 6 item 4.
- `aria-expanded` reflects open state → Task 1 (regression test) + Task 2 Step 3 preserves the attribute.
- Focus ring uses `ring-rouge` → Task 2 Step 3 (both className branches include `focus-visible:ring-rouge`).
- Hit target ≥ 36 px → `py-1.5` + `text-sm` + border = ~36 px; verified visually in Task 2 Step 6 item 5.
- No changes to `CardMessageAssist`, API route, or panel behavior → not in any task; existing tests in Task 2 Step 5 cover this.
- No `useState` shape changes → unchanged in Task 2 Step 3.

No gaps found.
