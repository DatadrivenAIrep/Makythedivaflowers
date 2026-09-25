import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DigitalCardSection from "@/components/admin/dashboard/DigitalCardSection";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const VIEW = { code: "Ab3dE5fG", shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG", targetUrl: null };
const GOOD = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

function mockFetch(...responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("DigitalCardSection", () => {
  it("activates a card", async () => {
    const fetchMock = mockFetch({ status: 200, body: VIEW });
    render(<DigitalCardSection orderId="o1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "digital_card_activate" }));
    await screen.findByText(VIEW.shortUrl);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/orders/o1/digital-card", { method: "POST" });
    expect(screen.getByText("digital_card_preparing")).toBeTruthy();
    expect(screen.getByRole("link", { name: "digital_card_download_qr" }).getAttribute("href"))
      .toBe("/api/admin/orders/o1/digital-card/qr");
  });

  it("saves a url and shows ready", async () => {
    const fetchMock = mockFetch({ status: 200, body: { ...VIEW, targetUrl: GOOD } });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: `  ${GOOD} ` } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    await screen.findByText("digital_card_ready");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ targetUrl: GOOD });
  });

  it("sends null for an empty url", async () => {
    const fetchMock = mockFetch({ status: 200, body: VIEW });
    render(<DigitalCardSection orderId="o1" initial={{ ...VIEW, targetUrl: GOOD }} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    await screen.findByText("digital_card_preparing");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ targetUrl: null });
  });

  it("shows the invalid-url error on 400", async () => {
    mockFetch({ status: 400, body: { error: "invalid_card_url" } });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.change(screen.getByLabelText("digital_card_url_label"), { target: { value: "https://evil.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "digital_card_save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("digital_card_invalid_url");
  });

  it("copies the short link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DigitalCardSection orderId="o1" initial={VIEW} />);
    fireEvent.click(screen.getByRole("button", { name: "digital_card_copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(VIEW.shortUrl));
    await screen.findByText("digital_card_copied");
  });
});
