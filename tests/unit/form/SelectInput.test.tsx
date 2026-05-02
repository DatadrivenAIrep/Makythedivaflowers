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

  it("applies error border when aria-invalid is string true", () => {
    render(
      <SelectInput name="x" id="f-x" aria-invalid="true">
        <option value="a">A</option>
      </SelectInput>,
    );
    expect(screen.getByRole("combobox").className).toMatch(/border-rouge/);
  });

  it("applies error border when aria-invalid is boolean true", () => {
    render(
      <SelectInput name="x" id="f-x" aria-invalid={true}>
        <option value="a">A</option>
      </SelectInput>,
    );
    expect(screen.getByRole("combobox").className).toMatch(/border-rouge/);
  });
});
