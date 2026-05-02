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
