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
