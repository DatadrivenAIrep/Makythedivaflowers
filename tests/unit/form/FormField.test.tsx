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

  it("renders help text with correct id for aria-describedby linking", () => {
    render(
      <FormField label="Email" htmlFor="f-e" help="We'll respond within 24h">
        <input id="f-e" aria-describedby="f-e-help" />
      </FormField>,
    );
    const help = screen.getByText(/respond within 24h/i);
    expect(help).toBeInTheDocument();
    expect(help).toHaveAttribute("id", "f-e-help");
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
