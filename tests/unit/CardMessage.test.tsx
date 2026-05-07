import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessage } from "@/components/product/CardMessage";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const baseProps = {
  locale: "en" as const,
  value: "",
  onChange: vi.fn(),
  productTitle: "Timeless Romance",
  occasions: ["anniversary"] as ("anniversary" | "sympathy" | "birthday")[],
};

describe("CardMessage", () => {
  it("renders the textarea and counter", () => {
    render(<CardMessage {...baseProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText(/0\/200/)).toBeInTheDocument();
  });

  it("calls onChange when the user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the assist trigger by default", () => {
    render(<CardMessage {...baseProps} />);
    expect(screen.getByRole("button", { name: /trigger/i })).toBeInTheDocument();
  });

  it("opens the assist panel on trigger click", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    expect(screen.getAllByRole("button", { name: /partner|pareja|mom/i })[0]).toBeInTheDocument();
  });

  it("uses sympathy chip set when occasions includes sympathy", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} occasions={["sympathy"]} />);
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    expect(screen.getByRole("button", { name: /coworker|compañerx/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^mom$|^papá$|^mamá$/i })).not.toBeInTheDocument();
  });

  it("toggles aria-expanded on the trigger when opening and closing the assist panel", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /trigger/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
