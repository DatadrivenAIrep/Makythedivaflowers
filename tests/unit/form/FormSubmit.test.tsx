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
