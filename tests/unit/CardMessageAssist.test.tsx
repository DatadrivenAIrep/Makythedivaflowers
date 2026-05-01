import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardMessageAssist } from "@/components/product/CardMessageAssist";

const COPY = {
  title: "Who's it for?",
  generate: "Generate 3 ideas",
  regenerate: "Generate 3 more",
  retry: "Retry",
  close: "Close",
  errorGeneric: "We couldn't generate right now.",
  errorRateLimit: "Too many requests. Try again in an hour.",
};

const RELATIONS = [
  { key: "partner", label: "Partner" },
  { key: "mother", label: "Mom" },
] as const;

const baseProps = {
  productTitle: "Timeless Romance",
  occasion: "anniversary" as const,
  locale: "en" as const,
  relations: RELATIONS as unknown as { key: string; label: string }[],
  copy: COPY,
  onPick: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  baseProps.onPick = vi.fn();
  baseProps.onClose = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("CardMessageAssist", () => {
  it("renders relation chips and disabled generate button initially", () => {
    render(<CardMessageAssist {...baseProps} />);
    expect(screen.getByRole("button", { name: /partner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mom/i })).toBeInTheDocument();
    const gen = screen.getByRole("button", { name: COPY.generate });
    expect(gen).toBeDisabled();
  });

  it("enables generate button after selecting a chip", async () => {
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    expect(screen.getByRole("button", { name: COPY.generate })).toBeEnabled();
  });

  it("shows skeleton while fetching", async () => {
    mockFetch(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ suggestions: ["a", "b", "c"] }), { status: 200 }),
              ),
            10,
          );
        }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByTestId("card-message-skeleton")).toBeInTheDocument();
  });

  it("renders three suggestion cards on success and onPick is called with the right text", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ suggestions: ["alpha", "beta", "gamma"] }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    const card = await screen.findByRole("button", { name: /alpha/i });
    await user.click(card);
    expect(baseProps.onPick).toHaveBeenCalledWith("alpha");
  });

  it("shows rate-limit copy on 429", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "rate_limit" }), { status: 429 }));
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByText(COPY.errorRateLimit)).toBeInTheDocument();
  });

  it("shows generic error on 502 with retry button", async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: "upstream" }), { status: 502 }));
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    expect(await screen.findByText(COPY.errorGeneric)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.retry })).toBeInTheDocument();
  });

  it("retry reuses the previously selected relation", async () => {
    let calls = 0;
    const captured: string[] = [];
    mockFetch(async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      captured.push(body.relation);
      if (calls === 1) return new Response(JSON.stringify({ error: "upstream" }), { status: 502 });
      return new Response(JSON.stringify({ suggestions: ["x", "y", "z"] }), { status: 200 });
    });
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /mom/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    await screen.findByText(COPY.errorGeneric);
    await user.click(screen.getByRole("button", { name: COPY.retry }));
    await screen.findByRole("button", { name: /^x$/i });
    expect(captured).toEqual(["mother", "mother"]);
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: COPY.close }));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("regenerate calls fetch a second time after success", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ suggestions: ["a", "b", "c"] }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<CardMessageAssist {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /partner/i }));
    await user.click(screen.getByRole("button", { name: COPY.generate }));
    await screen.findByRole("button", { name: /^a$/ });
    const regen = screen.getByRole("button", { name: COPY.regenerate });
    await user.click(regen);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });
  });
});
