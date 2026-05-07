import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessage } from "@/components/product/CardMessage";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  locale: "en" as const,
  value: "",
  onChange: vi.fn(),
  productTitle: "Timeless Romance",
  occasions: ["anniversary"] as string[],
  isSympathy: false,
};

function mockFetchCapture(): { captured: { body?: Record<string, unknown> } } {
  const captured: { body?: Record<string, unknown> } = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ suggestions: ["a", "b", "c"] }),
        { status: 200 },
      );
    }),
  );
  return { captured };
}

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

  it("uses sympathy chip set and bare label when isSympathy prop is true", async () => {
    const user = userEvent.setup();
    render(<CardMessage {...baseProps} isSympathy occasions={["sympathy"]} />);
    expect(screen.getByRole("button", { name: "trigger_sympathy" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "trigger_sympathy" }));
    expect(screen.getByRole("button", { name: /coworker|compañerx/i })).toBeInTheDocument();
  });

  it("uses default trigger label when occasions includes sympathy but isSympathy prop is false", () => {
    render(
      <CardMessage
        {...baseProps}
        isSympathy={false}
        occasions={["mothers-day", "anniversary", "sympathy"]}
      />,
    );
    expect(screen.getByRole("button", { name: /^.*trigger$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "trigger_sympathy" })).not.toBeInTheDocument();
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

  it("sends campaign occasion when product carries it", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        occasions={["birthday", "just-because", "mothers-day"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    await user.click(screen.getAllByRole("button", { name: /partner|mom/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("mothers-day");
  });

  it("falls back to first occasion when campaign is set but product doesn't carry it", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        occasions={["birthday", "just-because"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: /trigger/i }));
    await user.click(screen.getAllByRole("button", { name: /partner|mom/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("birthday");
  });

  it("sympathy beats campaign — isSympathy prop wins", async () => {
    const { captured } = mockFetchCapture();
    const user = userEvent.setup();
    render(
      <CardMessage
        {...baseProps}
        isSympathy
        occasions={["sympathy", "mothers-day"]}
        campaign="mothers-day"
      />,
    );
    await user.click(screen.getByRole("button", { name: "trigger_sympathy" }));
    await user.click(screen.getAllByRole("button", { name: /coworker|family|other/i })[0]);
    await user.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.occasion).toBe("sympathy");
  });
});
