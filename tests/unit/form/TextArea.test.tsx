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

  it("applies error border when aria-invalid is string true", () => {
    render(<TextArea name="m" id="f-m" aria-invalid="true" />);
    const ta = screen.getByRole("textbox");
    expect(ta.className).toMatch(/border-rouge/);
  });

  it("applies error border when aria-invalid is boolean true", () => {
    render(<TextArea name="m" id="f-m" aria-invalid={true} />);
    expect(screen.getByRole("textbox").className).toMatch(/border-rouge/);
  });
});
