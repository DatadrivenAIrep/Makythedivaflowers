import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromoCodeField } from "@/components/checkout/PromoCodeField";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function json(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body } as Response);
}

function setup(props: Partial<React.ComponentProps<typeof PromoCodeField>> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  render(
    <PromoCodeField
      subtotalCents={20000}
      deliveryCents={1500}
      locale="en"
      onApply={onApply}
      onClear={onClear}
      {...props}
    />,
  );
  return { onApply, onClear };
}

describe("PromoCodeField", () => {
  it("sends the typed code with the current order amounts", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(json({ valid: true, code: "TEN", discountCents: 2000 }));
    setup();

    await user.type(screen.getByLabelText("promo.label"), "ten");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      code: "ten",
      subtotalCents: 20000,
      deliveryCents: 1500,
    });
  });

  it("reports the applied discount to the parent", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(json({ valid: true, code: "TEN", discountCents: 2000 }));
    const { onApply } = setup();

    await user.type(screen.getByLabelText("promo.label"), "TEN");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));

    expect(onApply).toHaveBeenCalledWith({ code: "TEN", discountCents: 2000 });
  });

  it("shows a reason-specific message when the code is refused", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(json({ valid: false, reason: "expired" }));
    const { onApply } = setup();

    await user.type(screen.getByLabelText("promo.label"), "OLD");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));

    expect(screen.getByRole("alert")).toHaveTextContent("promo.error.expired");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for an unrecognised reason", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(json({ valid: false, reason: "something_new" }));
    setup();

    await user.type(screen.getByLabelText("promo.label"), "X");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));

    expect(screen.getByRole("alert")).toHaveTextContent("promo.error.invalid");
  });

  it("does not call the API for an empty code", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "promo.apply" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the buyer remove an applied code", async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(json({ valid: true, code: "TEN", discountCents: 2000 }));
    const { onClear } = setup();

    await user.type(screen.getByLabelText("promo.label"), "TEN");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));
    await user.click(await screen.findByRole("button", { name: "promo.remove" }));

    expect(onClear).toHaveBeenCalled();
    expect(screen.getByLabelText("promo.label")).toBeInTheDocument();
  });

  it("surfaces a network failure instead of failing silently", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("offline"));
    setup();

    await user.type(screen.getByLabelText("promo.label"), "TEN");
    await user.click(screen.getByRole("button", { name: "promo.apply" }));

    expect(screen.getByRole("alert")).toHaveTextContent("promo.error.invalid");
  });
});
