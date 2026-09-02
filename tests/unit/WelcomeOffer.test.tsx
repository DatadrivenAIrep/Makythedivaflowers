import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeOffer } from "@/components/conversion/WelcomeOffer";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

let pathname = "/es";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const fetchMock = vi.fn();

beforeEach(() => {
  pathname = "/es";
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The popup waits before appearing; this jumps that wait. */
async function appear() {
  render(<WelcomeOffer locale="es" />);
  await vi.advanceTimersByTimeAsync(9000);
}

describe("WelcomeOffer", () => {
  it("stays out of the way at first", async () => {
    render(<WelcomeOffer locale="es" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("appears after a moment on an ordinary page", async () => {
    await appear();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("never interrupts someone at checkout", async () => {
    pathname = "/es/checkout";
    await appear();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never interrupts someone in the cart or reading an order", async () => {
    pathname = "/es/cart";
    await appear();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays away from the admin", async () => {
    pathname = "/es/admin/dashboard";
    await appear();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends the number with the consent the law needs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await appear();
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("phone_label"), "5165550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/welcome");
    expect(JSON.parse(init.body)).toEqual({
      phone: "5165550100",
      locale: "es",
      marketingConsent: true,
    });
  });

  it("confirms rather than leaving the form up", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await appear();
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("phone_label"), "5165550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "submit" }));

    expect(await screen.findByText("sent_title")).toBeInTheDocument();
  });

  it("says so when the number is refused", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "invalid" }) });
    await appear();
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("phone_label"), "5165550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("error_phone");
  });

  it("does not come back once dismissed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<WelcomeOffer locale="es" />);
    await vi.advanceTimersByTimeAsync(9000);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "dismiss" }));
    unmount();

    render(<WelcomeOffer locale="es" />);
    await vi.advanceTimersByTimeAsync(9000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not come back after someone takes the offer either", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<WelcomeOffer locale="es" />);
    await vi.advanceTimersByTimeAsync(9000);
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("phone_label"), "5165550100");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "submit" }));
    await screen.findByText("sent_title");
    unmount();

    render(<WelcomeOffer locale="es" />);
    await vi.advanceTimersByTimeAsync(9000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
