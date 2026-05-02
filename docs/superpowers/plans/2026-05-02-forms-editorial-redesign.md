# Forms Editorial Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 8 forms (Contact, Weddings, Events, Subscription, Checkout, Auth, Newsletter, CardMessage) under a single editorial-split visual system with shared atoms — eliminating per-form duplication while preserving all existing logic.

**Architecture:** Two-layer system. Layer 1 = shared form atoms (`FormField`, `TextInput`, `TextArea`, `DateInput`, `SelectInput`, `RadioChips`, `FormSection`, `FormSubmit`). Layer 2 = editorial shell (`FormShell`) with two panel variants (`PhotoPanel`, `EditorialPanel`) and a `FormSuccess` cross-fade. Each form refactors to use these primitives — schemas, RHF setup, API routes, and i18n keys are unchanged. The work is purely presentational.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, vitest + @testing-library/react, @testing-library/user-event, jsdom, framer-motion, react-hook-form, @hookform/resolvers/zod, next-intl, clsx + tailwind-merge (`cn` helper at `lib/cn.ts`), Phosphor icons.

**Spec:** [docs/superpowers/specs/2026-05-02-forms-editorial-redesign-design.md](../specs/2026-05-02-forms-editorial-redesign-design.md)

**Branch strategy:** One feature branch `feat/forms-editorial-redesign`. One commit per task. Single PR at the end with before/after screenshots per form.

---

## File Structure

**New atoms — `components/ui/form/`:**
- `FormField.tsx` — wrapper (label + help + slot + error)
- `TextInput.tsx` — line-only input
- `TextArea.tsx` — boxed multi-line
- `DateInput.tsx` — boxed date input
- `SelectInput.tsx` — boxed native select
- `RadioChips.tsx` — pill-grid radio group
- `FormSection.tsx` — section divider with eyebrow + optional number
- `FormSubmit.tsx` — canonical submit button

**New shell — `components/ui/form/shell/`:**
- `FormShell.tsx` — split layout root
- `PhotoPanel.tsx` — image-cover left panel
- `EditorialPanel.tsx` — typographic left panel
- `FormSuccess.tsx` — success cross-fade right-side replacement

**New checkout-specific:**
- `components/checkout/OrderSummaryPanel.tsx` — domain panel for checkout left

**Tests — `tests/unit/form/`:**
- One `*.test.tsx` per atom and per shell component

**Modified (logic untouched, presentation refactored):**
- `components/inquiry/ContactForm.tsx`
- `components/inquiry/WeddingsForm.tsx`
- `components/inquiry/EventsForm.tsx`
- `components/subscription/SubscriptionInquiryForm.tsx`
- `components/checkout/CheckoutShell.tsx`
- `components/checkout/ContactStep.tsx`
- `components/checkout/DeliveryStep.tsx`
- `components/account/AuthForm.tsx`
- `components/home/NewsletterField.tsx`
- `components/product/CardMessage.tsx`

**Deleted:**
- `components/ui/Input.tsx` (legacy underline input, verified unused)

**i18n files modified (new shell copy keys):**
- `messages/en.json`
- `messages/es.json`

---

## Phase 0 · Setup

### Task 0: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to branch**

```bash
git checkout -b feat/forms-editorial-redesign
git status
```

Expected: on `feat/forms-editorial-redesign`, working tree clean.

- [ ] **Step 2: Confirm baseline tests pass**

```bash
npm test -- --reporter=basic
```

Expected: all unit tests pass (no regression baseline). If any fail, stop and investigate before adding new code.

---

## Phase 1 · Atoms

### Task 1: `FormField` wrapper atom

**Files:**
- Create: `components/ui/form/FormField.tsx`
- Create: `tests/unit/form/FormField.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/FormField.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/ui/form/FormField";

describe("FormField", () => {
  it("renders label, child input, and required asterisk", () => {
    render(
      <FormField label="Name" required htmlFor="f-name">
        <input id="f-name" />
      </FormField>,
    );
    const label = screen.getByText("Name");
    expect(label).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "f-name");
  });

  it("renders help text and links it via aria-describedby", () => {
    render(
      <FormField label="Email" htmlFor="f-e" help="We'll respond within 24h">
        <input id="f-e" aria-describedby="f-e-help" />
      </FormField>,
    );
    expect(screen.getByText(/respond within 24h/i)).toBeInTheDocument();
  });

  it("renders error in alert role when error is set", () => {
    render(
      <FormField label="Email" htmlFor="f-e" error="Invalid email">
        <input id="f-e" />
      </FormField>,
    );
    const err = screen.getByRole("alert");
    expect(err).toHaveTextContent("Invalid email");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/FormField.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FormField`**

```tsx
// components/ui/form/FormField.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: string;
  error?: string | false | null;
  className?: string;
  children: React.ReactNode;
};

export function FormField({ label, htmlFor, required, help, error, className, children }: Props) {
  const helpId = help ? `${htmlFor}-help` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("block", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-mono text-[12px] uppercase tracking-[0.16em] text-ink/70"
      >
        {label}
        {required && <span className="ml-0.5 text-rouge" aria-hidden="true">*</span>}
      </label>
      {children}
      {help && (
        <p id={helpId} className="mt-1.5 font-mono text-[11px] text-ink/55 leading-relaxed">
          {help}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 font-mono text-[11px] text-error leading-relaxed"
        >
          {error}
        </p>
      )}
    </div>
  );
}
```

> The `aria-describedby` wiring is the consumer's responsibility (passed onto the input via the atom in Task 2), since `FormField` doesn't know the input's id. The test only verifies presence; the input atom verifies wiring.

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/FormField.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/FormField.tsx tests/unit/form/FormField.test.tsx
git commit -m "feat(form): add FormField wrapper atom"
```

---

### Task 2: `TextInput` atom (line-only)

**Files:**
- Create: `components/ui/form/TextInput.tsx`
- Create: `tests/unit/form/TextInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/TextInput.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextInput } from "@/components/ui/form/TextInput";

describe("TextInput", () => {
  it("forwards ref and renders an input element", () => {
    render(<TextInput name="name" id="f-name" defaultValue="hi" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "name");
    expect(input).toHaveValue("hi");
  });

  it("applies font-size 16px to prevent iOS zoom on focus", () => {
    render(<TextInput name="x" id="f-x" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/text-base/);
  });

  it("applies error state styling when aria-invalid is true", () => {
    render(<TextInput name="x" id="f-x" aria-invalid="true" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/border-rouge/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/TextInput.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TextInput`**

```tsx
// components/ui/form/TextInput.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "block w-full bg-transparent border-0 border-b py-3 px-0",
        "font-sans text-base text-ink placeholder:text-mute-400",
        "outline-none transition-colors duration-200",
        isInvalid
          ? "border-b-[1.5px] border-rouge"
          : "border-b border-ink/20 hover:border-ink/35 focus:border-b-[1.5px] focus:border-rouge",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});
TextInput.displayName = "TextInput";
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/TextInput.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/TextInput.tsx tests/unit/form/TextInput.test.tsx
git commit -m "feat(form): add TextInput line-only atom"
```

---

### Task 3: `TextArea` atom (boxed multi-line)

**Files:**
- Create: `components/ui/form/TextArea.tsx`
- Create: `tests/unit/form/TextArea.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/TextArea.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextArea } from "@/components/ui/form/TextArea";

describe("TextArea", () => {
  it("renders a textarea with min-height and no resize", () => {
    render(<TextArea name="msg" id="f-msg" />);
    const ta = screen.getByRole("textbox");
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.className).toMatch(/resize-none/);
    expect(ta.className).toMatch(/min-h-/);
  });

  it("applies error border when aria-invalid", () => {
    render(<TextArea name="m" id="f-m" aria-invalid="true" />);
    const ta = screen.getByRole("textbox");
    expect(ta.className).toMatch(/border-rouge/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/TextArea.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `TextArea`**

```tsx
// components/ui/form/TextArea.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <textarea
      ref={ref}
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3.5 min-h-[110px] resize-none",
        "font-sans text-base text-ink placeholder:text-mute-400",
        "outline-none transition-colors duration-200",
        isInvalid
          ? "border border-rouge focus:ring-2 focus:ring-rouge/20"
          : "border border-ink/15 hover:border-ink/30 focus:border-rouge focus:ring-2 focus:ring-rouge/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
TextArea.displayName = "TextArea";
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/TextArea.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/TextArea.tsx tests/unit/form/TextArea.test.tsx
git commit -m "feat(form): add TextArea boxed atom"
```

---

### Task 4: `DateInput` atom

**Files:**
- Create: `components/ui/form/DateInput.tsx`
- Create: `tests/unit/form/DateInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/DateInput.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateInput } from "@/components/ui/form/DateInput";

describe("DateInput", () => {
  it("renders type=date input with mono font", () => {
    render(<DateInput name="d" id="f-d" defaultValue="2026-06-01" data-testid="d" />);
    const input = screen.getByTestId("d") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.className).toMatch(/font-mono/);
  });

  it("applies error border when aria-invalid", () => {
    render(<DateInput name="d" id="f-d" aria-invalid="true" data-testid="d" />);
    const input = screen.getByTestId("d");
    expect(input.className).toMatch(/border-rouge/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/DateInput.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `DateInput`**

```tsx
// components/ui/form/DateInput.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const DateInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <input
      ref={ref}
      type="date"
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3 font-mono text-sm text-ink",
        "outline-none transition-colors duration-200",
        isInvalid
          ? "border border-rouge focus:ring-2 focus:ring-rouge/20"
          : "border border-ink/15 hover:border-ink/30 focus:border-rouge focus:ring-2 focus:ring-rouge/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
DateInput.displayName = "DateInput";
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/DateInput.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/DateInput.tsx tests/unit/form/DateInput.test.tsx
git commit -m "feat(form): add DateInput atom"
```

---

### Task 5: `SelectInput` atom

**Files:**
- Create: `components/ui/form/SelectInput.tsx`
- Create: `tests/unit/form/SelectInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/SelectInput.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectInput } from "@/components/ui/form/SelectInput";

describe("SelectInput", () => {
  it("renders a native select with provided options", () => {
    render(
      <SelectInput name="x" id="f-x">
        <option value="a">A</option>
        <option value="b">B</option>
      </SelectInput>,
    );
    const sel = screen.getByRole("combobox") as HTMLSelectElement;
    expect(sel.options).toHaveLength(2);
  });

  it("applies error border when aria-invalid", () => {
    render(
      <SelectInput name="x" id="f-x" aria-invalid="true">
        <option value="a">A</option>
      </SelectInput>,
    );
    expect(screen.getByRole("combobox").className).toMatch(/border-rouge/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/SelectInput.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `SelectInput`**

```tsx
// components/ui/form/SelectInput.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export const SelectInput = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <select
      ref={ref}
      className={cn(
        "block w-full bg-bone rounded-lg px-4 py-3 font-sans text-base text-ink appearance-none",
        "outline-none transition-colors duration-200 cursor-pointer",
        isInvalid
          ? "border border-rouge focus:ring-2 focus:ring-rouge/20"
          : "border border-ink/15 hover:border-ink/30 focus:border-rouge focus:ring-2 focus:ring-rouge/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
SelectInput.displayName = "SelectInput";
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/SelectInput.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/SelectInput.tsx tests/unit/form/SelectInput.test.tsx
git commit -m "feat(form): add SelectInput atom"
```

---

### Task 6: `RadioChips` atom

**Files:**
- Create: `components/ui/form/RadioChips.tsx`
- Create: `tests/unit/form/RadioChips.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/RadioChips.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioChips } from "@/components/ui/form/RadioChips";

describe("RadioChips", () => {
  const items = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  it("renders one radio per item with name applied", () => {
    render(<RadioChips name="grp" items={items} value="a" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute("name", "grp");
  });

  it("marks the active value as checked", () => {
    render(<RadioChips name="grp" items={items} value="b" onChange={() => {}} />);
    expect(screen.getByLabelText("Beta")).toBeChecked();
  });

  it("calls onChange with the new value when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RadioChips name="grp" items={items} value="a" onChange={onChange} />);
    await user.click(screen.getByLabelText("Gamma"));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/RadioChips.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `RadioChips`**

```tsx
// components/ui/form/RadioChips.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Item = { value: string; label: string };

type Props = {
  name: string;
  items: ReadonlyArray<Item>;
  value: string | undefined;
  onChange: (value: string) => void;
  cols?: 2 | 3 | 4;
  className?: string;
  "aria-describedby"?: string;
};

export function RadioChips({ name, items, value, onChange, cols = 4, className, ...rest }: Props) {
  const colsCls = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div
      role="radiogroup"
      aria-describedby={rest["aria-describedby"]}
      className={cn("grid grid-cols-2 gap-2", colsCls, className)}
    >
      {items.map((it) => {
        const isActive = value === it.value;
        const id = `${name}-${it.value}`;
        return (
          <label
            key={it.value}
            htmlFor={id}
            className={cn(
              "cursor-pointer rounded-xl border px-4 py-3.5 text-center font-sans text-sm",
              "min-h-[52px] flex items-center justify-center transition-colors duration-200",
              isActive
                ? "border-rouge bg-rouge/[0.08] text-ink"
                : "border-ink/15 text-ink/70 hover:border-ink/30",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={it.value}
              checked={isActive}
              onChange={() => onChange(it.value)}
              className="sr-only"
            />
            {it.label}
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/RadioChips.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/RadioChips.tsx tests/unit/form/RadioChips.test.tsx
git commit -m "feat(form): add RadioChips pill-grid atom"
```

---

### Task 7: `FormSection` atom

**Files:**
- Create: `components/ui/form/FormSection.tsx`
- Create: `tests/unit/form/FormSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/FormSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSection } from "@/components/ui/form/FormSection";

describe("FormSection", () => {
  it("renders title and number when provided", () => {
    render(<FormSection title="Recipient" num={2} />);
    expect(screen.getByText("Recipient")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("renders title without number when num omitted", () => {
    render(<FormSection title="Address" />);
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.queryByText(/^\d{2}$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/FormSection.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `FormSection`**

```tsx
// components/ui/form/FormSection.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  num?: number;
  className?: string;
};

export function FormSection({ title, num, className }: Props) {
  const numStr = num !== undefined ? String(num).padStart(2, "0") : null;
  return (
    <div
      className={cn(
        "flex items-baseline gap-2.5 border-t border-ink/10 pt-3 mb-4",
        className,
      )}
    >
      {numStr && (
        <span className="font-display text-sm tracking-tight text-ink/40 leading-none">
          {numStr}
        </span>
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge">
        {title}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/FormSection.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/FormSection.tsx tests/unit/form/FormSection.test.tsx
git commit -m "feat(form): add FormSection divider atom"
```

---

### Task 8: `FormSubmit` atom

**Files:**
- Create: `components/ui/form/FormSubmit.tsx`
- Create: `tests/unit/form/FormSubmit.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/FormSubmit.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSubmit } from "@/components/ui/form/FormSubmit";

describe("FormSubmit", () => {
  it("renders a button of type submit with provided label", () => {
    render(<FormSubmit>Send</FormSubmit>);
    const btn = screen.getByRole("button", { name: /send/i });
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("is busy and disabled when loading, with a loading aria-label on the indicator", () => {
    render(<FormSubmit loading>Send</FormSubmit>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<FormSubmit disabled>Send</FormSubmit>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/FormSubmit.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `FormSubmit`**

```tsx
// components/ui/form/FormSubmit.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  loading?: boolean;
  fullWidth?: boolean;
};

export const FormSubmit = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, loading, fullWidth = true, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "bg-ink text-bone hover:bg-rouge",
          "px-8 py-4 min-h-[52px] font-sans text-sm font-medium tracking-tight",
          "transition-colors duration-200 outline-none",
          "focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          fullWidth ? "w-full sm:w-auto sm:self-end" : "",
          className,
        )}
        {...props}
      >
        {loading ? <LoadingDots /> : children}
      </button>
    );
  },
);
FormSubmit.displayName = "FormSubmit";

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse [animation-delay:-0.3s]" />
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse [animation-delay:-0.15s]" />
      <span className="h-1 w-1 rounded-full bg-bone animate-pulse" />
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/FormSubmit.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/FormSubmit.tsx tests/unit/form/FormSubmit.test.tsx
git commit -m "feat(form): add FormSubmit canonical button atom"
```

---

## Phase 2 · Shell + panels

### Task 9: `FormShell` split layout root

**Files:**
- Create: `components/ui/form/shell/FormShell.tsx`
- Create: `tests/unit/form/shell/FormShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/shell/FormShell.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormShell } from "@/components/ui/form/shell/FormShell";

describe("FormShell", () => {
  it("renders left panel and right form children", () => {
    render(
      <FormShell left={<div data-testid="L">L</div>}>
        <form data-testid="R">R</form>
      </FormShell>,
    );
    expect(screen.getByTestId("L")).toBeInTheDocument();
    expect(screen.getByTestId("R")).toBeInTheDocument();
  });

  it("includes a skip-link to the form", () => {
    render(
      <FormShell left={<div>L</div>}>
        <form>R</form>
      </FormShell>,
    );
    expect(screen.getByText(/skip to form/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/shell/FormShell.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `FormShell`**

```tsx
// components/ui/form/shell/FormShell.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = {
  left: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  formId?: string;
};

export function FormShell({ left, children, className, formId = "form-content" }: Props) {
  return (
    <section className={cn("relative", className)}>
      <a
        href={`#${formId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-ink focus:text-bone focus:px-4 focus:py-2 focus:rounded-md focus:font-mono focus:text-xs"
      >
        Skip to form
      </a>
      <div className="grid md:grid-cols-[42fr_58fr] min-h-[640px]">
        <div className="relative overflow-hidden md:min-h-full min-h-[280px]">
          {left}
        </div>
        <div id={formId} className="bg-bone px-6 py-10 md:px-12 md:py-14">
          {children}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/shell/FormShell.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/shell/FormShell.tsx tests/unit/form/shell/FormShell.test.tsx
git commit -m "feat(form): add FormShell split layout root"
```

---

### Task 10: `PhotoPanel` variant

**Files:**
- Create: `components/ui/form/shell/PhotoPanel.tsx`
- Create: `tests/unit/form/shell/PhotoPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/shell/PhotoPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhotoPanel } from "@/components/ui/form/shell/PhotoPanel";

describe("PhotoPanel", () => {
  it("renders eyebrow, title, and body", () => {
    render(
      <PhotoPanel
        src="/weddings/01.webp"
        alt=""
        eyebrow="Weddings"
        title="A wedding is a single afternoon."
        body="We respond within one business day."
      />,
    );
    expect(screen.getByText("Weddings")).toBeInTheDocument();
    expect(screen.getByText(/single afternoon/i)).toBeInTheDocument();
    expect(screen.getByText(/respond within one business day/i)).toBeInTheDocument();
  });

  it("renders title as an h2 for hierarchy", () => {
    render(<PhotoPanel src="/x.jpg" alt="" eyebrow="A" title="The title" />);
    expect(screen.getByRole("heading", { level: 2, name: "The title" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/shell/PhotoPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `PhotoPanel`**

```tsx
// components/ui/form/shell/PhotoPanel.tsx
import * as React from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  body?: string;
  signature?: string;
  priority?: boolean;
};

export function PhotoPanel({ src, alt, eyebrow, title, body, signature, priority }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 42vw"
        priority={priority}
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/15"
      />
      <div className="relative z-10 flex h-full flex-col justify-end p-6 md:p-12 text-bone">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-3">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl md:text-4xl tracking-tighter leading-[0.95] mb-4">
          {title}
        </h2>
        {body && (
          <p className="font-sans text-sm leading-relaxed text-bone/85 max-w-md hidden md:block">
            {body}
          </p>
        )}
        {signature && (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45 hidden md:block">
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/shell/PhotoPanel.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/shell/PhotoPanel.tsx tests/unit/form/shell/PhotoPanel.test.tsx
git commit -m "feat(form): add PhotoPanel variant"
```

---

### Task 11: `EditorialPanel` variant

**Files:**
- Create: `components/ui/form/shell/EditorialPanel.tsx`
- Create: `tests/unit/form/shell/EditorialPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/shell/EditorialPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";

describe("EditorialPanel", () => {
  it("renders eyebrow, title (h2), and optional body", () => {
    render(
      <EditorialPanel
        eyebrow="Talk to us"
        title="Tell us what you're imagining."
        body="One business day."
      />,
    );
    expect(screen.getByText("Talk to us")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /imagining/i })).toBeInTheDocument();
    expect(screen.getByText(/one business day/i)).toBeInTheDocument();
  });

  it("renders numbered steps when provided", () => {
    render(
      <EditorialPanel
        eyebrow="Process"
        title="How it works"
        steps={[
          { title: "Send inquiry", body: "Under 2 min." },
          { title: "We reply", body: "Within 24h." },
        ]}
      />,
    );
    expect(screen.getByText("Send inquiry")).toBeInTheDocument();
    expect(screen.getByText("We reply")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/shell/EditorialPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `EditorialPanel`**

```tsx
// components/ui/form/shell/EditorialPanel.tsx
import * as React from "react";

type Step = { title: string; body: string };

type Props = {
  eyebrow: string;
  title: string;
  body?: string;
  steps?: ReadonlyArray<Step>;
  signature?: string;
};

export function EditorialPanel({ eyebrow, title, body, steps, signature }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px] overflow-hidden bg-gradient-to-br from-ink to-[#2a1a16] text-bone">
      <div
        aria-hidden="true"
        className="absolute -right-12 -bottom-16 h-72 w-72 rounded-full bg-rouge/30 blur-3xl"
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-3">
            {eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tighter leading-[0.95] mb-4 max-w-md">
            {title}
          </h2>
          {body && (
            <p className="font-sans text-sm leading-relaxed text-bone/85 max-w-md hidden md:block">
              {body}
            </p>
          )}
          {steps && steps.length > 0 && (
            <ol className="mt-8 flex flex-col gap-4 max-w-md hidden md:flex">
              {steps.map((s, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <span className="font-display text-lg text-rouge tracking-tight w-6 flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-bone/85">
                    <strong className="text-bone font-medium">{s.title}</strong>
                    <br />
                    {s.body}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {signature && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45 hidden md:block">
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/shell/EditorialPanel.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/shell/EditorialPanel.tsx tests/unit/form/shell/EditorialPanel.test.tsx
git commit -m "feat(form): add EditorialPanel variant"
```

---

### Task 12: `FormSuccess` cross-fade replacement

**Files:**
- Create: `components/ui/form/shell/FormSuccess.tsx`
- Create: `tests/unit/form/shell/FormSuccess.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/form/shell/FormSuccess.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";

describe("FormSuccess", () => {
  it("renders title (focusable h2) and body", () => {
    render(<FormSuccess title="Inquiry sent." body="We'll be in touch within 24h." />);
    const h = screen.getByRole("heading", { level: 2, name: /inquiry sent/i });
    expect(h).toBeInTheDocument();
    expect(h).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByText(/within 24h/i)).toBeInTheDocument();
  });

  it("renders an action button when action prop is provided", () => {
    render(
      <FormSuccess
        title="Done"
        body="."
        action={{ label: "Send another", onClick: () => {} }}
      />,
    );
    expect(screen.getByRole("button", { name: /send another/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/form/shell/FormSuccess.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `FormSuccess`**

```tsx
// components/ui/form/shell/FormSuccess.tsx
"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";

type Action = { label: string; onClick: () => void };

type Props = {
  title: string;
  body: string;
  action?: Action;
};

export function FormSuccess({ title, body, action }: Props) {
  const reduce = useReducedMotion();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      className="flex flex-col items-start gap-4"
    >
      <motion.span
        initial={reduce ? { scale: 1 } : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 14 }}
        className="inline-flex items-center justify-center size-10 rounded-full bg-rouge text-bone"
      >
        <Check size={18} weight="bold" />
      </motion.span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-4xl text-ink leading-[0.95] tracking-tighter outline-none"
      >
        {title}
      </h2>
      <p className="text-ink/70 max-w-md leading-relaxed">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:text-rouge/80"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- tests/unit/form/shell/FormSuccess.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/form/shell/FormSuccess.tsx tests/unit/form/shell/FormSuccess.test.tsx
git commit -m "feat(form): add FormSuccess cross-fade component"
```

---

### Task 12.5: Run full test suite checkpoint

- [ ] **Step 1: Run all unit tests**

```bash
npm test -- --reporter=basic
```

Expected: all tests pass (existing + new atom/shell tests). If any fail, stop and fix before proceeding to migrations.

---

## Phase 3 · Migrations

> Each migration replaces the form's local helpers with the shared atoms + shell, refactors the JSX, and updates i18n with new shell keys. Logic (RHF, schemas, fetch, honeypot) is untouched. After each, the existing unit + e2e tests for that form must continue to pass.

### Task 13: Migrate `AuthForm`

**Files:**
- Modify: `components/account/AuthForm.tsx`
- Modify: `messages/en.json` and `messages/es.json`

- [ ] **Step 1: Add new shell i18n keys for Auth**

Open `messages/en.json` and find the `account.sign-in` and `account.sign-up` blocks. Add a `shell` sub-object to each:

```json
"sign-in": {
  "shell": {
    "eyebrow": "Welcome back",
    "title": "Sign in to your account.",
    "body": "Manage subscriptions, view orders, and update your delivery preferences.",
    "signature": "— Diva, NYC"
  },
  ...existing keys
}
```

Repeat for `sign-up`:

```json
"sign-up": {
  "shell": {
    "eyebrow": "Create account",
    "title": "Begin a relationship with Diva.",
    "body": "We'll save your preferences for future arrangements and send order updates.",
    "signature": "— Diva, NYC"
  },
  ...existing keys
}
```

Mirror in `messages/es.json` with Spanish copy:

```json
"sign-in": {
  "shell": {
    "eyebrow": "Bienvenido de vuelta",
    "title": "Inicia sesión en tu cuenta.",
    "body": "Gestiona suscripciones, consulta órdenes y actualiza tus preferencias de entrega.",
    "signature": "— Diva, NYC"
  }
},
"sign-up": {
  "shell": {
    "eyebrow": "Crear cuenta",
    "title": "Comienza una relación con Diva.",
    "body": "Guardaremos tus preferencias para futuros arreglos y te enviaremos actualizaciones de tus pedidos.",
    "signature": "— Diva, NYC"
  }
}
```

- [ ] **Step 2: Refactor `AuthForm.tsx` to use shell + atoms**

Replace the entire contents of `components/account/AuthForm.tsx` with:

```tsx
// components/account/AuthForm.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { FormSubmit } from "@/components/ui/form/FormSubmit";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations(`account.${mode}`);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <FormShell
      left={
        <EditorialPanel
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
          signature={t("shell.signature")}
        />
      }
    >
      {submitted ? (
        <FormSuccess title={t("stub_title")} body={t("stub_body")} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {/* TODO: wire RHF + zodResolver + honeypot when replacing stub with real auth */}
          {mode === "sign-up" && (
            <FormField label={t("name")} htmlFor="auth-name" required>
              <TextInput id="auth-name" type="text" name="name" autoComplete="name" required />
            </FormField>
          )}
          <FormField label={t("email")} htmlFor="auth-email" required>
            <TextInput id="auth-email" type="email" name="email" autoComplete="email" required />
          </FormField>
          <FormField label={t("password")} htmlFor="auth-password" required>
            <TextInput
              id="auth-password"
              type="password"
              name="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </FormField>
          <FormSubmit>{t("submit")}</FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
```

- [ ] **Step 3: Verify rendering manually**

```bash
npm run dev
```

Open `http://localhost:3000/en/account/sign-in` and `http://localhost:3000/en/account/sign-up`. Confirm:
- Left panel shows the editorial copy with rouge eyebrow + serif headline + body + signature.
- Right side shows the form with the new line-only inputs and pill submit.
- Submitting the form replaces the right side with the success message and shifts focus to the heading.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass (no AuthForm test exists; e2e covers `account-stubs.spec.ts`).

- [ ] **Step 5: Run e2e for accounts**

```bash
npx playwright test tests/e2e/account-stubs.spec.ts
```

Expected: pass. If it fails because a selector changed, inspect — most selectors should be label/role-based and survive.

- [ ] **Step 6: Commit**

```bash
git add components/account/AuthForm.tsx messages/en.json messages/es.json
git commit -m "feat(account): migrate AuthForm to FormShell + atoms"
```

---

### Task 14: Migrate `ContactForm`

**Files:**
- Modify: `components/inquiry/ContactForm.tsx`
- Modify: `messages/en.json` and `messages/es.json`
- Modify: `app/[locale]/contact/page.tsx` (remove duplicated container if present)

- [ ] **Step 1: Read current page wrapper**

```bash
cat "app/[locale]/contact/page.tsx"
```

Identify any wrapper container (max-width, padding, header) currently around `<ContactForm />`. The new shell brings its own layout — outer container should typically reduce to `<ContactForm />` with at most a thin section wrapper.

- [ ] **Step 2: Add new shell i18n keys for Contact**

In `messages/en.json`, locate the `contact.form` block. Add `shell` keys next to existing `name`, `email`, etc.:

```json
"contact": {
  "form": {
    "shell": {
      "eyebrow": "Talk to us",
      "title": "Tell us what you're imagining.",
      "body": "We design for moments — birthdays, brand launches, ceremonies. Share the occasion and we'll respond within one business day.",
      "signature": "— Diva, NYC"
    },
    ...existing keys
  }
}
```

Mirror in `messages/es.json`:

```json
"contact": {
  "form": {
    "shell": {
      "eyebrow": "Hablemos",
      "title": "Cuéntanos qué estás imaginando.",
      "body": "Diseñamos momentos — cumpleaños, lanzamientos, ceremonias. Comparte la ocasión y respondemos en un día hábil.",
      "signature": "— Diva, NYC"
    }
  }
}
```

- [ ] **Step 3: Refactor `ContactForm.tsx`**

Replace `components/inquiry/ContactForm.tsx` with:

```tsx
// components/inquiry/ContactForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { contactSchema, type ContactInput } from "@/schemas/contact";
import type { Locale } from "@/types/locale";

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations("contact.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      body: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: ContactInput) {
    setState("submitting");
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  const errors = form.formState.errors;

  return (
    <FormShell
      left={
        <EditorialPanel
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
          signature={t("shell.signature")}
        />
      }
    >
      {state === "success" ? (
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
          <HoneypotField register={form.register("honeypot")} />
          <input type="hidden" {...form.register("locale")} />
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("name")} htmlFor="contact-name" required error={errors.name?.message}>
              <TextInput
                id="contact-name"
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "contact-name-error" : undefined}
                {...form.register("name")}
              />
            </FormField>
            <FormField label={t("email")} htmlFor="contact-email" required error={errors.email?.message}>
              <TextInput
                id="contact-email"
                type="email"
                aria-invalid={!!errors.email || undefined}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                {...form.register("email")}
              />
            </FormField>
          </div>
          <FormField label={t("subject")} htmlFor="contact-subject" required error={errors.subject?.message}>
            <TextInput
              id="contact-subject"
              aria-invalid={!!errors.subject || undefined}
              aria-describedby={errors.subject ? "contact-subject-error" : undefined}
              {...form.register("subject")}
            />
          </FormField>
          <FormField label={t("body")} htmlFor="contact-body" required error={errors.body?.message}>
            <TextArea
              id="contact-body"
              rows={6}
              aria-invalid={!!errors.body || undefined}
              aria-describedby={errors.body ? "contact-body-error" : undefined}
              {...form.register("body")}
            />
          </FormField>
          {errorMsg && (
            <p role="alert" className="font-mono text-[11px] text-error">
              {t(`errors.${errorMsg}` as Parameters<typeof t>[0])}
            </p>
          )}
          <FormSubmit loading={state === "submitting"}>
            {state === "submitting" ? t("submitting") : t("submit")}
          </FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
```

- [ ] **Step 4: Adjust `app/[locale]/contact/page.tsx`**

If the page currently wraps `<ContactForm />` in a constrained container (e.g. `<div className="max-w-2xl mx-auto px-6 py-20">`), change to a full-width section that lets the shell breathe. Read the file and adjust the wrapper. The form's inner padding is handled by `FormShell` (`px-6 py-10 md:px-12 md:py-14`).

- [ ] **Step 5: Manual render check**

```bash
npm run dev
```

Open `http://localhost:3000/en/contact`. Confirm:
- Two-column split on desktop (~768px+), stacked on mobile.
- Left ink panel with rouge halo, eyebrow + serif headline + body + signature.
- Right form with line-only inputs and a single boxed textarea for the message.
- Submit button at full-width on mobile, auto-width right-aligned on desktop.

Stop dev server.

- [ ] **Step 6: Run e2e for contact**

```bash
npx playwright test tests/e2e/contact.spec.ts
```

Expected: pass. Selectors are by label/role.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add components/inquiry/ContactForm.tsx messages/en.json messages/es.json "app/[locale]/contact/page.tsx"
git commit -m "feat(contact): migrate ContactForm to FormShell + EditorialPanel"
```

---

### Task 15: Migrate `NewsletterField` (atoms only)

**Files:**
- Modify: `components/home/NewsletterField.tsx`

> Newsletter does NOT use the FormShell — it's an inline section in the homepage with its own established two-column layout. Only the input + submit are upgraded to the new atoms; the rest is preserved.

- [ ] **Step 1: Refactor input + submit, preserve outer layout and motion**

Replace `components/home/NewsletterField.tsx` with:

```tsx
"use client";
import { memo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { TextInput } from "@/components/ui/form/TextInput";
import { FormSubmit } from "@/components/ui/form/FormSubmit";

function NewsletterFieldImpl() {
  const t = useTranslations("home.newsletter");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const reduceMotion = useReducedMotion();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    await new Promise((r) => setTimeout(r, 600));
    if (!email.includes("@")) {
      setState("error");
      return;
    }
    setState("success");
  };

  return (
    <section className="py-24">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 items-end">
        <div className="md:col-span-5 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-none">
            {t("title")}
          </h2>
        </div>
        <form onSubmit={onSubmit} className="md:col-span-7 relative min-h-[68px]">
          <AnimatePresence mode="wait">
            {state !== "success" && (
              <motion.div
                key="form"
                initial={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="flex items-end gap-4"
              >
                <TextInput
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("placeholder")}
                  aria-label={t("placeholder")}
                  disabled={state === "submitting"}
                  className="flex-1"
                />
                <FormSubmit
                  loading={state === "submitting"}
                  fullWidth={false}
                  className="shrink-0"
                >
                  {t("cta")}
                </FormSubmit>
              </motion.div>
            )}
            {state === "success" && (
              <motion.div
                key="success"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 14 }}
                className="flex items-center gap-3 text-rouge"
              >
                <span className="inline-flex items-center justify-center size-8 rounded-full bg-rouge text-bone">
                  <Check size={16} weight="bold" />
                </span>
                <span className="font-display text-2xl tracking-tighter">{t("success")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {state === "error" && (
            <p className="absolute -bottom-6 left-0 font-mono text-xs text-error">{t("error")}</p>
          )}
        </form>
      </div>
    </section>
  );
}

export const NewsletterField = memo(NewsletterFieldImpl);
```

- [ ] **Step 2: Manual render check**

```bash
npm run dev
```

Open `http://localhost:3000/en` and scroll to the newsletter section. Confirm:
- Layout is unchanged (two-column home section).
- Input is line-only with rouge focus border.
- Submit pill is ink → rouge on hover.
- Success state still animates as before.

Stop dev server.

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add components/home/NewsletterField.tsx
git commit -m "feat(home): upgrade Newsletter to shared form atoms"
```

---

### Task 16: Migrate `CardMessage` (atoms only)

**Files:**
- Modify: `components/product/CardMessage.tsx`

> CardMessage is an embedded textarea inside cart/PDP. No shell. Replace local field/textarea styling with atoms.

- [ ] **Step 1: Read current `CardMessage.tsx`**

```bash
cat components/product/CardMessage.tsx
```

Identify the local textarea + label markup and any associated character counter / AI assist trigger.

- [ ] **Step 2: Refactor to use `FormField` + `TextArea`**

Edit `components/product/CardMessage.tsx`. Replace the inline `<label>` + `<textarea>` pair with:

```tsx
import { FormField } from "@/components/ui/form/FormField";
import { TextArea } from "@/components/ui/form/TextArea";
```

Then in the JSX, where the label + textarea currently lives, swap to:

```tsx
<FormField label={t("label")} htmlFor="card-message">
  <TextArea
    id="card-message"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    maxLength={200}
    rows={3}
    placeholder={t("placeholder")}
  />
</FormField>
```

> Keep all surrounding logic (character counter, AI assist trigger, max length enforcement, save handler) unchanged. Only the visual label + textarea elements are replaced.

- [ ] **Step 3: Manual render check**

```bash
npm run dev
```

Add a product to cart, open the card-message UI in cart drawer. Confirm:
- Label is the new mono uppercase 12px style.
- Textarea has the new rounded-lg boxed style with rouge focus.
- Character counter and AI assist trigger remain functional.

Stop dev server.

- [ ] **Step 4: Run CardMessage tests**

```bash
npm test -- tests/unit/CardMessage.test.tsx tests/unit/CardMessageAssist.test.tsx
```

Expected: pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/product/CardMessage.tsx
git commit -m "feat(product): upgrade CardMessage to shared form atoms"
```

---

### Task 17: Migrate `WeddingsForm` (first PhotoPanel)

**Files:**
- Modify: `components/inquiry/WeddingsForm.tsx`
- Modify: `messages/en.json` and `messages/es.json`
- Modify: `app/[locale]/weddings/page.tsx` (adjust outer wrapper if needed)

- [ ] **Step 1: Pick the curated wedding photo**

Inspect the available images:

```bash
ls -la "public/weddings/"
```

Pick one image that reads as warm, intimate, and not too literal-bridal (avoid full bride portraits — pick a tablescape or bouquet detail). Suggested: `public/weddings/05.webp`. Note the chosen path; it goes in the component as `src`.

- [ ] **Step 2: Add shell i18n keys for Weddings**

In `messages/en.json`, under `weddings.form`:

```json
"weddings": {
  "form": {
    "shell": {
      "eyebrow": "Weddings · est. 2018",
      "title": "A wedding is a single afternoon. We treat it that way.",
      "body": "Two months of design, one florist team, one ceremony. Tell us when, where, and what you're imagining — we respond within one business day.",
      "signature": "— Diva, NYC",
      "alt": "Wedding floral arrangement detail"
    }
  }
}
```

In `messages/es.json`:

```json
"weddings": {
  "form": {
    "shell": {
      "eyebrow": "Bodas · desde 2018",
      "title": "Una boda es una sola tarde. La tratamos así.",
      "body": "Dos meses de diseño, un equipo, una ceremonia. Cuéntanos cuándo, dónde y qué imaginas — respondemos en un día hábil.",
      "signature": "— Diva, NYC",
      "alt": "Detalle de arreglo floral nupcial"
    }
  }
}
```

- [ ] **Step 3: Refactor `WeddingsForm.tsx`**

Replace `components/inquiry/WeddingsForm.tsx` with:

```tsx
// components/inquiry/WeddingsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { PhotoPanel } from "@/components/ui/form/shell/PhotoPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { DateInput } from "@/components/ui/form/DateInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { weddingInquirySchema, type WeddingInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

type WeddingInquiryInput = z.input<typeof weddingInquirySchema>;
const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;

export function WeddingsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<WeddingInquiryInput, unknown, WeddingInquiry>({
    resolver: zodResolver(weddingInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "wedding",
      contact: { name: "", email: "", phone: "" },
      date: "",
      venue: "",
      guests: undefined,
      budgetBand: "open",
      vibe: "",
      source: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: WeddingInquiry) {
    setState("submitting");
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  const errors = form.formState.errors;
  const watchedBudget = form.watch("budgetBand");

  const budgetItems = BUDGETS.map((b) => ({ value: b, label: b }));

  return (
    <FormShell
      left={
        <PhotoPanel
          src="/weddings/05.webp"
          alt={t("shell.alt")}
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
          signature={t("shell.signature")}
          priority
        />
      }
    >
      {state === "success" ? (
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
          <HoneypotField register={form.register("honeypot")} />
          <input type="hidden" {...form.register("type")} />
          <input type="hidden" {...form.register("locale")} />

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("name")} htmlFor="w-name" required error={errors.contact?.name?.message}>
              <TextInput id="w-name" aria-invalid={!!errors.contact?.name || undefined} {...form.register("contact.name")} />
            </FormField>
            <FormField label={t("email")} htmlFor="w-email" required error={errors.contact?.email?.message}>
              <TextInput id="w-email" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
            </FormField>
          </div>

          <FormField label={t("phone")} htmlFor="w-phone" error={errors.contact?.phone?.message}>
            <TextInput id="w-phone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
          </FormField>

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("date")} htmlFor="w-date">
              <DateInput id="w-date" {...form.register("date")} />
            </FormField>
            <FormField label={t("venue")} htmlFor="w-venue">
              <TextInput id="w-venue" placeholder="Glen Cove Mansion" {...form.register("venue")} />
            </FormField>
          </div>

          <FormField label={t("guests")} htmlFor="w-guests" error={errors.guests?.message}>
            <TextInput
              id="w-guests"
              type="number"
              inputMode="numeric"
              min={1}
              max={2000}
              aria-invalid={!!errors.guests || undefined}
              {...form.register("guests")}
            />
          </FormField>

          <FormField label={t("budget")} htmlFor="w-budget">
            <RadioChips
              name="budgetBand"
              items={budgetItems}
              value={watchedBudget}
              onChange={(v) => form.setValue("budgetBand", v as typeof BUDGETS[number])}
            />
          </FormField>

          <FormField label={t("vibe")} htmlFor="w-vibe" required error={errors.vibe?.message}>
            <TextArea id="w-vibe" rows={5} aria-invalid={!!errors.vibe || undefined} {...form.register("vibe")} />
          </FormField>

          <FormField label={t("source")} htmlFor="w-source" error={errors.source?.message}>
            <TextInput id="w-source" {...form.register("source")} />
          </FormField>

          {errorMsg && (
            <p role="alert" className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>
          )}

          <FormSubmit loading={state === "submitting"}>
            {state === "submitting" ? t("submitting") : t("submit")}
          </FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
```

- [ ] **Step 4: Adjust `app/[locale]/weddings/page.tsx`**

Read the file. If `<WeddingsForm />` is currently wrapped in a max-width container, change to a full-width section so the shell can render edge-to-edge within the page section.

- [ ] **Step 5: Manual render check**

```bash
npm run dev
```

Open `http://localhost:3000/en/weddings` and scroll to the form. Confirm:
- Photo panel on left with proper aspect (full height of the section, gradient bottom for legibility).
- Eyebrow + serif headline + body in bone over the photo.
- Right form has all fields, budget chips highlight rouge when selected.
- Submit a test inquiry — success replaces the form, photo persists.

Stop dev server.

- [ ] **Step 6: Run e2e**

```bash
npx playwright test tests/e2e/weddings-inquiry.spec.ts
```

Expected: pass.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add components/inquiry/WeddingsForm.tsx messages/en.json messages/es.json "app/[locale]/weddings/page.tsx"
git commit -m "feat(weddings): migrate WeddingsForm to FormShell + PhotoPanel"
```

---

### Task 18: Migrate `EventsForm`

**Files:**
- Modify: `components/inquiry/EventsForm.tsx`
- Modify: `messages/en.json` and `messages/es.json`
- Modify: `app/[locale]/events/page.tsx`

- [ ] **Step 1: Add shell i18n keys for Events**

In `messages/en.json` under `events.form`:

```json
"events": {
  "form": {
    "shell": {
      "eyebrow": "Events & Brand",
      "title": "Florals as part of how a brand or moment is felt.",
      "body": "From a single launch to a quarterly residency — we plan, design, and install for the cadence you need."
    }
  }
}
```

In `messages/es.json`:

```json
"events": {
  "form": {
    "shell": {
      "eyebrow": "Eventos y Marca",
      "title": "Las flores como parte de cómo se siente una marca o un momento.",
      "body": "Desde un lanzamiento puntual hasta una residencia trimestral — planeamos, diseñamos e instalamos a la cadencia que necesites."
    }
  }
}
```

- [ ] **Step 2: Refactor `EventsForm.tsx`**

Replace `components/inquiry/EventsForm.tsx` with:

```tsx
// components/inquiry/EventsForm.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/components/inquiry/HoneypotField";
import { FormShell } from "@/components/ui/form/shell/FormShell";
import { EditorialPanel } from "@/components/ui/form/shell/EditorialPanel";
import { FormSuccess } from "@/components/ui/form/shell/FormSuccess";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { TextArea } from "@/components/ui/form/TextArea";
import { RadioChips } from "@/components/ui/form/RadioChips";
import { FormSubmit } from "@/components/ui/form/FormSubmit";
import { eventInquirySchema, type EventInquiry } from "@/schemas/inquiry";
import type { Locale } from "@/types/locale";

type EventInquiryInput = z.input<typeof eventInquirySchema>;
const FREQUENCIES = ["one-time", "weekly", "biweekly", "monthly", "quarterly"] as const;
const BUDGETS = ["5-10k", "10-25k", "25k+", "open"] as const;

export function EventsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("events.form");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<EventInquiryInput, unknown, EventInquiry>({
    resolver: zodResolver(eventInquirySchema),
    mode: "onBlur",
    defaultValues: {
      type: "event",
      contact: { name: "", email: "", phone: "" },
      company: "",
      frequency: "one-time",
      budgetBand: "open",
      vibe: "",
      locale,
      honeypot: "",
    },
  });

  async function onSubmit(values: EventInquiry) {
    setState("submitting");
    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.errors?.formErrors?.[0] ?? "unknown_error");
      setState("error");
      return;
    }
    setState("success");
    form.reset();
  }

  const errors = form.formState.errors;
  const watchedFreq = form.watch("frequency");
  const watchedBudget = form.watch("budgetBand");

  const freqItems = FREQUENCIES.map((f) => ({
    value: f,
    label: t(`freq_${f}` as Parameters<typeof t>[0]),
  }));
  const budgetItems = BUDGETS.map((b) => ({
    value: b,
    label: t(`budget_${b}` as Parameters<typeof t>[0]),
  }));

  return (
    <FormShell
      left={
        <EditorialPanel
          eyebrow={t("shell.eyebrow")}
          title={t("shell.title")}
          body={t("shell.body")}
        />
      }
    >
      {state === "success" ? (
        <FormSuccess title={t("success_title")} body={t("success_body")} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
          <HoneypotField register={form.register("honeypot")} />
          <input type="hidden" {...form.register("type")} />
          <input type="hidden" {...form.register("locale")} />

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label={t("name")} htmlFor="e-name" required error={errors.contact?.name?.message}>
              <TextInput id="e-name" aria-invalid={!!errors.contact?.name || undefined} {...form.register("contact.name")} />
            </FormField>
            <FormField label={t("email")} htmlFor="e-email" required error={errors.contact?.email?.message}>
              <TextInput id="e-email" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
            </FormField>
          </div>

          <FormField label={t("phone")} htmlFor="e-phone" error={errors.contact?.phone?.message}>
            <TextInput id="e-phone" type="tel" inputMode="tel" {...form.register("contact.phone")} />
          </FormField>

          <FormField label={t("company")} htmlFor="e-company" required error={errors.company?.message}>
            <TextInput id="e-company" {...form.register("company")} />
          </FormField>

          <FormField label={t("frequency")} htmlFor="e-frequency" error={errors.frequency?.message}>
            <RadioChips
              name="frequency"
              items={freqItems}
              cols={3}
              value={watchedFreq}
              onChange={(v) => form.setValue("frequency", v as typeof FREQUENCIES[number])}
            />
          </FormField>

          <FormField label={t("budget")} htmlFor="e-budget" error={errors.budgetBand?.message}>
            <RadioChips
              name="budgetBand"
              items={budgetItems}
              value={watchedBudget}
              onChange={(v) => form.setValue("budgetBand", v as typeof BUDGETS[number])}
            />
          </FormField>

          <FormField label={t("brief")} htmlFor="e-brief" required error={errors.vibe?.message}>
            <TextArea id="e-brief" rows={5} aria-invalid={!!errors.vibe || undefined} {...form.register("vibe")} />
          </FormField>

          {errorMsg && (
            <p role="alert" className="font-mono text-[11px] text-error">
              {t(`errors.${errorMsg}` as Parameters<typeof t>[0])}
            </p>
          )}

          <FormSubmit loading={state === "submitting"}>
            {state === "submitting" ? t("submitting") : t("submit")}
          </FormSubmit>
        </form>
      )}
    </FormShell>
  );
}
```

- [ ] **Step 3: Adjust `app/[locale]/events/page.tsx`** if it has a constraining outer container.

- [ ] **Step 4: Manual render check**

```bash
npm run dev
```

Open `http://localhost:3000/en/events`. Confirm split layout, editorial panel, frequency chips in 3 columns on desktop, budget chips in 4 columns. Stop dev server.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/inquiry/EventsForm.tsx messages/en.json messages/es.json "app/[locale]/events/page.tsx"
git commit -m "feat(events): migrate EventsForm to FormShell + EditorialPanel"
```

---

### Task 19: Migrate `SubscriptionInquiryForm`

**Files:**
- Modify: `components/subscription/SubscriptionInquiryForm.tsx`
- Modify: `messages/en.json` and `messages/es.json`

- [ ] **Step 1: Add shell i18n keys for Subscription**

In `messages/en.json` under `subscriptions.form`, add a `shell` block alongside existing `heading`, `subheading`, etc.:

```json
"shell": {
  "eyebrow": "A weekly ritual",
  "title": "Flowers, every week. Quietly delivered.",
  "body": "Pick a cadence and a window — we handle the rest, with notes that change with the season.",
  "alt": "Subscription bouquet"
}
```

In `messages/es.json`:

```json
"shell": {
  "eyebrow": "Un ritual semanal",
  "title": "Flores, cada semana. Entregadas con calma.",
  "body": "Elige una cadencia y una ventana — nosotros nos encargamos del resto, con notas que cambian con la estación.",
  "alt": "Ramo de suscripción"
}
```

- [ ] **Step 2: Read the current Subscription form to understand the AI assist embed**

```bash
cat components/subscription/SubscriptionInquiryForm.tsx
```

Note the structure: hidden fields, cadence chips, start date, recipient, address, window slot, contact, card mode (fixed/rotation), card message + AI assist, notes, submit. The AI assist block (`watchedMode === "fixed"` branch + the fetch effect) stays intact.

- [ ] **Step 3: Refactor — replace local Field/Textarea/Heading and the outer `<section>` with shell + atoms**

Replace `components/subscription/SubscriptionInquiryForm.tsx`. Key transformations:
- Remove the local `Field`, `Textarea`, `Heading` helper functions at the bottom of the file.
- Remove the outer `<section id="inquire" className="bg-petal/40 ...">` and `<header>`; replace with `<FormShell>` taking the heading/subheading content into a `<PhotoPanel>` (using the plan's product image).
- Replace each `<Field ... />` with `<FormField><TextInput ... /></FormField>`.
- Replace each `<Textarea ... />` with `<FormField><TextArea ... /></FormField>`.
- Replace each `<Heading>` with `<FormSection title="..." num={N} />`.
- Replace each radio `<fieldset>` with `<FormField label=...><RadioChips ... /></FormField>`.
- Replace the `<select>` blocks (cardOccasion, cardRelation) with `<SelectInput>` wrapped in `<FormField>`.
- Replace the bottom `<button type="submit">` with `<FormSubmit>`.
- Wrap success state with `<FormSuccess>` inside `<FormShell>`.

Use the plan's product image: `findSubscriptionPlan(plan).image` if it exists; if the plan data doesn't expose an image, use the existing approach (see how `SubscriptionTiers` references plan visuals) and pass the URL to `<PhotoPanel src=... />`.

> Concrete code skeleton:

```tsx
<FormShell
  left={
    <PhotoPanel
      src={planImage}
      alt={t("shell.alt")}
      eyebrow={t("shell.eyebrow")}
      title={t("shell.title")}
      body={t("shell.body")}
      priority
    />
  }
>
  {state === "success" ? (
    <FormSuccess title={t("success_title")} body={t("success_body")} />
  ) : (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md" noValidate>
      <HoneypotField register={form.register("honeypot")} />
      <input type="hidden" {...form.register("type")} />
      <input type="hidden" {...form.register("locale")} />
      <input type="hidden" {...form.register("plan")} />

      <FormField label={t("cadence_label")} htmlFor="s-cadence">
        <RadioChips
          name="cadence"
          items={CADENCES.map((c) => ({ value: c, label: t(`cadence.${c}`) }))}
          cols={2}
          value={watchedCadence}
          onChange={(v) => form.setValue("cadence", v as typeof CADENCES[number])}
        />
      </FormField>

      <FormField label={t("start_date_label")} htmlFor="s-start" required help={t("start_date_help")}
        error={errors.startDate?.message && t(`errors.${errors.startDate.message}`)}>
        <DateInput id="s-start" aria-invalid={!!errors.startDate || undefined} {...form.register("startDate")} />
      </FormField>

      <FormSection title={t("recipient_heading")} num={1} />
      {/* recipient name + phone via FormField + TextInput */}

      <FormSection title={t("address_heading")} num={2} />
      {/* address fields via FormField + TextInput */}

      <FormField label={t("window_label")} htmlFor="s-window">
        <RadioChips
          name="window.slot"
          items={SLOTS.map((s) => ({ value: s, label: t(`window.${s}`) }))}
          value={watchedSlot}
          onChange={(v) => form.setValue("window.slot", v as typeof SLOTS[number])}
        />
      </FormField>

      <FormSection title={t("contact_heading")} num={3} />
      {/* contact email + phone */}

      <FormField label={t("card_mode_heading")} htmlFor="s-cardmode" help={t(watchedMode === "rotation" ? "card_mode_rotation_help" : "card_mode_fixed_help")}>
        <RadioChips
          name="cardMessageMode"
          items={[{ value: "fixed", label: t("card_mode_fixed") }, { value: "rotation", label: t("card_mode_rotation") }]}
          cols={2}
          value={watchedMode}
          onChange={(v) => form.setValue("cardMessageMode", v as "fixed" | "rotation")}
        />
      </FormField>

      {watchedMode === "fixed" ? (
        /* ...fixed branch: TextArea via FormField + AI assist trigger + CardMessageAssist (unchanged logic) */
      ) : (
        /* ...rotation branch: two SelectInputs (cardOccasion + cardRelation) inside FormField, then existing preview block */
      )}

      <FormField label={t("notes_label")} htmlFor="s-notes" help={t("notes_help")}>
        <TextArea id="s-notes" rows={3} maxLength={1000} {...form.register("notes")} />
      </FormField>

      {errorMsg && <p role="alert" className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>}

      <FormSubmit loading={state === "submitting"}>
        {state === "submitting" ? t("submitting") : t("submit")}
      </FormSubmit>
    </form>
  )}
</FormShell>
```

> Translate every existing field this way. Keep the `useEffect` that fetches the rotation preview unchanged. Keep `CardMessageAssist` props unchanged.

- [ ] **Step 4: Confirm plan image source**

```bash
grep -n "image" data/subscription-plans.ts 2>/dev/null || true
ls public/products/ | head -5
```

If plan data doesn't include an image, hardcode a fallback per plan in the component (e.g. `petit → /products/blush-enchantment.jpg`, `maison → /products/timeless-romance.jpg`, `atelier → /products/hundred-roses-vase.png`) using a small lookup. This keeps the design unblocked; cleaner data wiring is a follow-up.

- [ ] **Step 5: Manual render check**

```bash
npm run dev
```

Open `http://localhost:3000/en/subscriptions/maison` (or whichever route renders this form). Confirm:
- Photo panel shows the plan product image left.
- Form on right with sections numbered (Recipient · 01, Address · 02, Contact · 03), chips for cadence/window/card mode.
- Toggle card mode fixed↔rotation: AI assist still works in fixed; rotation preview still fetches and renders suggestions.
- Submit a valid payload — success replaces the form, photo persists.

Stop dev server.

- [ ] **Step 6: Run unit + e2e**

```bash
npm test -- tests/unit/SubscriptionInquiryForm.test.tsx tests/unit/CardMessageAssist.test.tsx
npx playwright test tests/e2e/subscriptions.spec.ts
```

Expected: pass. The Subscription unit test queries by label text — those labels are unchanged.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add components/subscription/SubscriptionInquiryForm.tsx messages/en.json messages/es.json
git commit -m "feat(subscription): migrate SubscriptionInquiryForm to FormShell + atoms"
```

---

### Task 20: Build `OrderSummaryPanel` for Checkout

**Files:**
- Create: `components/checkout/OrderSummaryPanel.tsx`
- Create: `tests/unit/form/shell/OrderSummaryPanel.test.tsx`

> This is the Checkout-specific left panel. Renders the cart summary editorially: dark ink background, eyebrow, line items with thumbnail + name + qty/price, subtotal/delivery/total stack with total in display serif. Mobile collapses to an accordion.

- [ ] **Step 1: Read cart store + cart helpers to understand shape**

```bash
cat lib/cart-store.ts 2>/dev/null || grep -rn "useCart\b" components/cart 2>/dev/null | head
cat lib/cart-helpers.ts 2>/dev/null
```

Identify: cart line item type (id, name, image, price, qty), totals helpers, currency format. Note the imports the new component will need.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/unit/form/shell/OrderSummaryPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";

const items = [
  { id: "a", name: "Blush Enchantment", image: "/products/blush-enchantment.jpg", price: 12500, qty: 1 },
  { id: "b", name: "Timeless Romance", image: "/products/timeless-romance.jpg", price: 18000, qty: 2 },
];

describe("OrderSummaryPanel", () => {
  it("renders an eyebrow and each line item", () => {
    render(<OrderSummaryPanel items={items} subtotal={48500} delivery={1500} total={50000} currency="USD" />);
    expect(screen.getByText(/your order/i)).toBeInTheDocument();
    expect(screen.getByText("Blush Enchantment")).toBeInTheDocument();
    expect(screen.getByText("Timeless Romance")).toBeInTheDocument();
  });

  it("renders subtotal, delivery, and total", () => {
    render(<OrderSummaryPanel items={items} subtotal={48500} delivery={1500} total={50000} currency="USD" />);
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
    expect(screen.getByText(/delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npm test -- tests/unit/form/shell/OrderSummaryPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 4: Implement `OrderSummaryPanel`**

```tsx
// components/checkout/OrderSummaryPanel.tsx
"use client";
import * as React from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/format";

export type OrderLine = {
  id: string;
  name: string;
  image: string;
  price: number; // cents
  qty: number;
};

type Props = {
  items: ReadonlyArray<OrderLine>;
  subtotal: number;
  delivery: number;
  total: number;
  currency: string;
  eyebrow?: string;
};

export function OrderSummaryPanel({ items, subtotal, delivery, total, currency, eyebrow = "Your order" }: Props) {
  return (
    <div className="relative h-full min-h-[280px] md:min-h-[640px] bg-gradient-to-br from-ink to-[#2a1a16] text-bone overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -right-12 -bottom-16 h-72 w-72 rounded-full bg-rouge/25 blur-3xl"
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rouge mb-6">{eyebrow}</p>
          <ul className="flex flex-col gap-4">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4">
                <div className="relative size-12 rounded-md overflow-hidden bg-bone/10 flex-shrink-0">
                  <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base text-bone leading-tight tracking-tight truncate">
                    {it.name}
                  </p>
                  <p className="font-mono text-[11px] text-bone/60 mt-0.5">
                    {it.qty} × {formatCurrency(it.price, currency)}
                  </p>
                </div>
                <p className="font-mono text-sm text-bone/85 flex-shrink-0">
                  {formatCurrency(it.price * it.qty, currency)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 border-t border-bone/15 pt-4 space-y-2 text-sm">
          <Row label="Subtotal" value={formatCurrency(subtotal, currency)} />
          <Row label="Delivery" value={formatCurrency(delivery, currency)} />
          <div className="flex items-baseline justify-between pt-3 border-t border-bone/10">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/70">Total</span>
            <span className="font-display text-2xl tracking-tighter">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/60">{label}</span>
      <span className="font-mono text-sm text-bone/85">{value}</span>
    </div>
  );
}
```

> If `lib/format.ts` does not export `formatCurrency`, inspect what's there and use the existing currency formatter (e.g. `formatPrice`). Adjust the import to match.

- [ ] **Step 5: Run test to verify pass**

```bash
npm test -- tests/unit/form/shell/OrderSummaryPanel.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/OrderSummaryPanel.tsx tests/unit/form/shell/OrderSummaryPanel.test.tsx
git commit -m "feat(checkout): add OrderSummaryPanel domain component"
```

---

### Task 21: Migrate Checkout (`CheckoutShell` + `ContactStep` + `DeliveryStep`)

**Files:**
- Modify: `components/checkout/CheckoutShell.tsx`
- Modify: `components/checkout/ContactStep.tsx`
- Modify: `components/checkout/DeliveryStep.tsx`

- [ ] **Step 1: Read current `CheckoutShell.tsx` to understand step state machine**

```bash
cat components/checkout/CheckoutShell.tsx
```

Identify how `ContactStep` and `DeliveryStep` are composed, where the current order summary lives (if at all), and the submit behavior.

- [ ] **Step 2: Refactor `ContactStep.tsx`**

Replace `components/checkout/ContactStep.tsx` with a version that uses `FormField` + `TextInput`:

```tsx
// components/checkout/ContactStep.tsx
"use client";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import type { CheckoutInput } from "@/schemas/checkout";

type Props = { form: UseFormReturn<CheckoutInput> };

export function ContactStep({ form }: Props) {
  const t = useTranslations("checkout");
  const { register, formState } = form;
  const errors = formState.errors.contact;
  return (
    <div className="space-y-5 max-w-md">
      <FormField label={t("email")} htmlFor="ck-email" required
        error={errors?.email && t(`errors.${errors.email.message ?? "email_invalid"}`)}>
        <TextInput
          id="ck-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors?.email || undefined}
          {...register("contact.email")}
        />
      </FormField>
      <FormField label={t("phone")} htmlFor="ck-phone" required
        error={errors?.phone && t(`errors.${errors.phone.message ?? "phone_too_short"}`)}>
        <TextInput
          id="ck-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={!!errors?.phone || undefined}
          {...register("contact.phone")}
        />
      </FormField>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `DeliveryStep.tsx`**

Replace `components/checkout/DeliveryStep.tsx` with:

```tsx
// components/checkout/DeliveryStep.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form/FormField";
import { TextInput } from "@/components/ui/form/TextInput";
import { DateInput } from "@/components/ui/form/DateInput";
import { RadioChips } from "@/components/ui/form/RadioChips";
import type { CheckoutInput } from "@/schemas/checkout";

const SLOTS = ["morning", "midday", "afternoon", "evening"] as const;

export function DeliveryStep({ form }: { form: UseFormReturn<CheckoutInput> }) {
  const t = useTranslations("checkout");
  const { register, formState, watch, setValue } = form;
  const min = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const errors = formState.errors.delivery;
  const selectedSlot = watch("delivery.window.slot");

  const slotItems = SLOTS.map((s) => ({ value: s, label: t(`slot_${s}`) }));

  return (
    <div className="space-y-6 max-w-md">
      <div className="grid sm:grid-cols-2 gap-5">
        <FormField label={t("recipient_name")} htmlFor="ck-rname" required
          error={errors?.recipient?.name && t("errors.name_too_short")}>
          <TextInput id="ck-rname" {...register("delivery.recipient.name")} />
        </FormField>
        <FormField label={t("recipient_phone")} htmlFor="ck-rphone" required
          error={errors?.recipient?.phone && t("errors.phone_too_short")}>
          <TextInput id="ck-rphone" type="tel" inputMode="tel" {...register("delivery.recipient.phone")} />
        </FormField>
      </div>
      <FormField label={t("address_street1")} htmlFor="ck-street1" required
        error={errors?.address?.street1 && t("errors.street_required")}>
        <TextInput id="ck-street1" autoComplete="address-line1" {...register("delivery.address.street1")} />
      </FormField>
      <FormField label={t("address_street2")} htmlFor="ck-street2">
        <TextInput id="ck-street2" autoComplete="address-line2" {...register("delivery.address.street2")} />
      </FormField>
      <div className="grid sm:grid-cols-3 gap-5">
        <FormField label={t("address_city")} htmlFor="ck-city" required
          error={errors?.address?.city && t("errors.city_required")}>
          <TextInput id="ck-city" autoComplete="address-level2" {...register("delivery.address.city")} />
        </FormField>
        <FormField label={t("address_state")} htmlFor="ck-state" required
          error={errors?.address?.state && t("errors.state_invalid")}>
          <TextInput id="ck-state" maxLength={2} autoComplete="address-level1" {...register("delivery.address.state")} />
        </FormField>
        <FormField label={t("address_zip")} htmlFor="ck-zip" required
          error={errors?.address?.zip && t("errors.zip_invalid")}>
          <TextInput id="ck-zip" inputMode="numeric" autoComplete="postal-code" {...register("delivery.address.zip")} />
        </FormField>
      </div>
      <input type="hidden" value="US" {...register("delivery.address.country")} />
      <FormField label={t("delivery_date")} htmlFor="ck-date"
        error={errors?.window?.date && t("errors.date_invalid")}>
        <DateInput id="ck-date" min={min} {...register("delivery.window.date")} />
      </FormField>
      <FormField label={t("delivery_window")} htmlFor="ck-window">
        <RadioChips
          name="delivery.window.slot"
          items={slotItems}
          value={selectedSlot}
          onChange={(v) => setValue("delivery.window.slot", v as typeof SLOTS[number])}
        />
      </FormField>
      <FormField label={t("card_message")} htmlFor="ck-card" help={t("card_message_hint")}>
        <TextInput id="ck-card" maxLength={200} {...register("delivery.cardMessage")} />
      </FormField>
    </div>
  );
}
```

- [ ] **Step 4: Refactor `CheckoutShell.tsx` to use `FormShell` + `OrderSummaryPanel`**

Edit `components/checkout/CheckoutShell.tsx`. The shell becomes:

```tsx
<FormShell
  left={
    <OrderSummaryPanel
      items={cartItems}
      subtotal={subtotal}
      delivery={deliveryFee}
      total={total}
      currency="USD"
    />
  }
>
  {/* existing step state machine: ContactStep → DeliveryStep → submit */}
  {/* on success, render <FormSuccess title=... body=... /> */}
  {/* keep all existing form logic, only replace the right-side container/heading and submit button */}
</FormShell>
```

Replace the existing submit button with `<FormSubmit loading={...}>`. Replace any local headings with `<FormSection num={1} title={t("contact_step")} />` and `<FormSection num={2} title={t("delivery_step")} />`.

> If the existing `CheckoutShell` had its own success state, replace it with `<FormSuccess>`. If it redirects to the order confirmation page on success, leave the redirect intact.

- [ ] **Step 5: Mobile accordion for OrderSummaryPanel**

`OrderSummaryPanel` currently shows full content always. For checkout mobile, wrap its rendering in `CheckoutShell` so that on `<md`, it collapses to a top accordion:

```tsx
<details className="md:hidden border-b border-ink/10 px-6 py-4 bg-petal/40">
  <summary className="cursor-pointer flex items-center justify-between">
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/70">
      {t("order_details_summary", { count: items.length, total: formatCurrency(total, "USD") })}
    </span>
    <span aria-hidden="true">▾</span>
  </summary>
  <div className="mt-4">
    <OrderSummaryPanel ... />
  </div>
</details>
<div className="hidden md:block">
  <FormShell left={<OrderSummaryPanel ... />}>...</FormShell>
</div>
```

Add `checkout.order_details_summary` i18n key in EN and ES (e.g., `"Order details · {count} items · {total}"` / `"Detalles · {count} artículos · {total}"`).

- [ ] **Step 6: Manual render check**

```bash
npm run dev
```

Add a product to cart, navigate to checkout. Confirm:
- Desktop: split with order summary on left, contact/delivery steps on right.
- Mobile: order summary as a collapsed accordion on top, form below.
- All existing checkout flows work end-to-end (data validation, slot selection, submit).

Stop dev server.

- [ ] **Step 7: Run e2e for checkout**

```bash
npx playwright test tests/e2e/checkout.spec.ts
```

Expected: pass.

- [ ] **Step 8: Run full test suite**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add components/checkout/CheckoutShell.tsx components/checkout/ContactStep.tsx components/checkout/DeliveryStep.tsx messages/en.json messages/es.json
git commit -m "feat(checkout): migrate CheckoutShell to FormShell + OrderSummaryPanel"
```

---

## Phase 4 · Cleanup + verification

### Task 22: Delete legacy `ui/Input.tsx` and audit imports

**Files:**
- Delete: `components/ui/Input.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "components/ui/Input\b" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v ".worktrees"
```

Expected: no output (no consumers).

- [ ] **Step 2: Delete the file**

```bash
git rm components/ui/Input.tsx
```

- [ ] **Step 3: Run full suite to confirm nothing breaks**

```bash
npm test -- --reporter=basic
npx tsc --noEmit
```

Expected: tests pass; typecheck clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(form): remove unused legacy ui/Input component"
```

---

### Task 23: Final verification + screenshot pass

- [ ] **Step 1: Run all unit tests**

```bash
npm test -- --reporter=basic
```

Expected: all pass.

- [ ] **Step 2: Run all e2e tests**

```bash
npx playwright test
```

Expected: all pass. If any fail, inspect and fix; do not bypass.

- [ ] **Step 3: Run typecheck and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: clean typecheck, successful production build.

- [ ] **Step 4: Manual screenshot pass**

```bash
npm run dev
```

For each of the following routes, take a screenshot (desktop + mobile breakpoint via DevTools 390px):
- `/en/contact`
- `/en/weddings`
- `/en/events`
- `/en/subscriptions/maison`
- `/en/checkout` (with cart populated)
- `/en/account/sign-in`
- `/en/account/sign-up`
- `/en` (newsletter section)
- Cart drawer with card-message embed

Compare to baseline (the original UI). Confirm:
- All forms have the new editorial layout where applicable (Newsletter and CardMessage retain their original layout structure with upgraded atoms only).
- No accessibility regressions: keyboard-tab through each form, confirm focus rings are visible, confirm screen reader announces labels and errors.
- Reduced motion: enable "Reduce motion" in OS settings, refresh, confirm cross-fades and stagger are instant.

Stop dev server.

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin feat/forms-editorial-redesign
```

Open the PR with title "feat: editorial redesign for all forms" and a body that includes a per-form before/after screenshot table and a checklist of what changed (atoms centralized, shell + panels added, 8 forms migrated, legacy Input removed).

---

## What is NOT touched (verification)

After the plan completes, the following must remain unchanged (verify with `git diff main -- <path>`):

- `schemas/contact.ts`, `schemas/inquiry.ts`, `schemas/checkout.ts`, `schemas/subscription-inquiry.ts`, `schemas/newsletter.ts`, `schemas/card-message.ts`
- `app/api/contact/route.ts`, `app/api/inquiry/route.ts`, `app/api/checkout/route.ts`, `app/api/newsletter/route.ts`, `app/api/card-message/route.ts`
- `lib/submit-order.ts`, `lib/submit-subscription-inquiry.ts`, `lib/card-message-prompt.ts`, `lib/card-message-relations.ts`, `lib/delivery.ts`, `lib/format.ts`, `lib/contact-subject.ts`
- `components/inquiry/HoneypotField.tsx`
- `components/motion/MagneticButton.tsx` (used by hero CTAs, not by form submits anymore)

If any of these show modifications, revert them — only presentation should change.
