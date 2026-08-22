// tests/unit/sheet-material.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as Dialog from "@radix-ui/react-dialog";
import { Sheet, SheetContent } from "@/components/ui/Sheet";

// Radix Dialog.Content warns without a Dialog.Title for a11y. Every real
// consumer supplies its own title; here we add a visually-hidden one purely
// to keep test output pristine (no console warnings), per SheetContent's
// contract that it never hardcodes a title itself.
function HiddenTitle({ children }: { children: string }) {
  return <Dialog.Title className="sr-only">{children}</Dialog.Title>;
}

describe("SheetContent material", () => {
  it("renders children inside a dialog when open", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <HiddenTitle>Bag</HiddenTitle>
          <p>Bag contents</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Bag contents")).toBeInTheDocument();
  });

  it("uses the translucent material surface (not the old opaque bone)", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom" data-testid="content">
          <HiddenTitle>Bag</HiddenTitle>
          hi
        </SheetContent>
      </Sheet>,
    );
    const el = screen.getByTestId("content");
    // material background comes from --material-bg; the class encodes it
    expect(el.className).toMatch(/material|backdrop-blur|\[background:var\(--material-bg\)\]/);
  });
});
