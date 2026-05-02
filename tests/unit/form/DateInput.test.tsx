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

  it("applies error border when aria-invalid is string true", () => {
    render(<DateInput name="d" id="f-d" aria-invalid="true" data-testid="d" />);
    const input = screen.getByTestId("d");
    expect(input.className).toMatch(/border-rouge/);
  });

  it("applies error border when aria-invalid is boolean true", () => {
    render(<DateInput name="d" id="f-d" aria-invalid={true} data-testid="d" />);
    expect(screen.getByTestId("d").className).toMatch(/border-rouge/);
  });
});
