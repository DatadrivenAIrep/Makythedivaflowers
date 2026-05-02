import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SubscriptionInquiryForm } from "@/components/subscription/SubscriptionInquiryForm";

function renderForm(plan: "petit" | "maison" | "atelier" = "maison") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SubscriptionInquiryForm locale="en" plan={plan} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SubscriptionInquiryForm", () => {
  it("renders required fields", () => {
    renderForm();
    expect(screen.getByLabelText(/recipient name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^street$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^city$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^zip$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^phone$/i)).toBeInTheDocument();
  });

  it("submits a valid payload and shows success", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: "iq_test" }),
    });
    const user = userEvent.setup();
    renderForm("atelier");

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().slice(0, 10);

    await user.type(screen.getByLabelText(/recipient name/i), "Lola Cardona");
    await user.type(screen.getByLabelText(/recipient phone/i), "5165550101");
    await user.type(screen.getByLabelText(/start date/i), futureStr);
    await user.type(screen.getByLabelText(/^street$/i), "1 Park Ave");
    await user.type(screen.getByLabelText(/^city$/i), "New York");
    await user.clear(screen.getByLabelText(/^state/i));
    await user.type(screen.getByLabelText(/^state/i), "NY");
    await user.type(screen.getByLabelText(/^zip$/i), "10010");
    await user.type(screen.getByLabelText(/^email$/i), "lola@example.com");
    await user.type(screen.getByLabelText(/^phone$/i), "5165550101");

    await user.click(screen.getByRole("button", { name: /send subscription request/i }));

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch/i)).toBeInTheDocument();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inquiry",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("subscription");
    expect(body.plan).toBe("atelier");
    expect(body.cadence).toBe("weekly");
  });

  it("shows validation errors when submitting empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /send subscription request/i }));
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
    const errors = await screen.findAllByRole("alert");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("shows error banner when server returns { ok: false }", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, errors: { formErrors: ["unknown_error"] } }),
    });
    const user = userEvent.setup();
    renderForm("maison");

    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().slice(0, 10);

    await user.type(screen.getByLabelText(/recipient name/i), "Lola Cardona");
    await user.type(screen.getByLabelText(/recipient phone/i), "5165550101");
    await user.type(screen.getByLabelText(/start date/i), futureStr);
    await user.type(screen.getByLabelText(/^street$/i), "1 Park Ave");
    await user.type(screen.getByLabelText(/^city$/i), "New York");
    await user.clear(screen.getByLabelText(/^state/i));
    await user.type(screen.getByLabelText(/^state/i), "NY");
    await user.type(screen.getByLabelText(/^zip$/i), "10010");
    await user.type(screen.getByLabelText(/^email$/i), "lola@example.com");
    await user.type(screen.getByLabelText(/^phone$/i), "5165550101");

    await user.click(screen.getByRole("button", { name: /send subscription request/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/something went wrong/i),
      ).toBeInTheDocument();
    });
  });
});
