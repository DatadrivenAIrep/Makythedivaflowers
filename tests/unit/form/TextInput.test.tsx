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

  it("applies error state styling when aria-invalid is string true", () => {
    render(<TextInput name="x" id="f-x" aria-invalid="true" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/border-rouge/);
  });

  it("applies error state styling when aria-invalid is boolean true", () => {
    render(<TextInput name="x" id="f-x" aria-invalid={true} />);
    expect(screen.getByRole("textbox").className).toMatch(/border-rouge/);
  });
});
