import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("MobileMenuButton", () => {
  it("renders a button with accessible label", () => {
    render(<MobileMenuButton onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "open_menu" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileMenuButton onClick={handler} />);
    await user.click(screen.getByRole("button", { name: "open_menu" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
