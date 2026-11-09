import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LoyaltyRewardField,
  type AppliedLoyaltyReward,
} from "@/components/checkout/LoyaltyRewardField";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function res(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
}

const REWARDS = [
  { id: "r5", percent: 5, label: "5% off" },
  { id: "r15", percent: 15, label: "15% off" },
];

/** Routes the mocked fetch by URL so each test only states what differs. */
function routes(map: Record<string, () => Promise<Response>>) {
  fetchMock.mockImplementation((url: string) => {
    const handler = map[url];
    if (!handler) throw new Error(`unexpected fetch ${url}`);
    return handler();
  });
}

function Harness({
  initialPhone = "5551234567",
  onApply,
  onClear,
  onStatus,
}: {
  initialPhone?: string;
  onApply?: (r: AppliedLoyaltyReward) => void;
  onClear?: () => void;
  onStatus?: (s: string) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [applied, setApplied] = useState<AppliedLoyaltyReward | null>(null);
  return (
    <>
      <button type="button" onClick={() => setPhone("5559999999")}>
        change-phone
      </button>
      <LoyaltyRewardField
        phone={phone}
        locale="en"
        applied={applied}
        onApply={(r) => {
          setApplied(r);
          onApply?.(r);
        }}
        onClear={() => {
          setApplied(null);
          onClear?.();
        }}
        onStatus={(s) => onStatus?.(s)}
      />
    </>
  );
}

describe("LoyaltyRewardField", () => {
  it("shows nothing when lookup is unavailable", async () => {
    const onStatus = vi.fn();
    routes({ "/api/checkout/loyalty/lookup": () => res({ status: "unavailable" }) });
    const { container } = render(<Harness onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("unavailable"));
    expect(container.textContent).toBe("change-phone");
  });

  it("does not look up a phone with fewer than 10 digits", async () => {
    render(<Harness initialPhone="55512" />);
    await new Promise((r) => setTimeout(r, 600));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preselects the highest percent", async () => {
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
    });
    render(<Harness />);
    expect(await screen.findByText("loyalty_has_reward")).toBeInTheDocument();
    const picked = screen.getByRole("radio", { checked: true });
    expect(picked).toHaveAccessibleName("15% off");
  });

  it("asks for a code before applying and calls onApply with the proof", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
      "/api/checkout/loyalty/verify": () => res({ proof: "P1", rewards: REWARDS }),
    });
    render(<Harness onApply={onApply} />);

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    expect(onApply).not.toHaveBeenCalled();
    const sendCall = fetchMock.mock.calls.find((c) => c[0] === "/api/checkout/loyalty/send-code");
    expect(JSON.parse(sendCall![1].body)).toEqual({ phone: "5551234567", locale: "en" });

    await user.type(await screen.findByLabelText("loyalty_code_label"), "123456");
    await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({
        id: "r15",
        percent: 15,
        label: "15% off",
        proof: "P1",
      }),
    );
    const verifyCall = fetchMock.mock.calls.find((c) => c[0] === "/api/checkout/loyalty/verify");
    expect(JSON.parse(verifyCall![1].body)).toEqual({ phone: "5551234567", code: "123456" });
    expect(await screen.findByText("loyalty_applied")).toBeInTheDocument();
  });

  it("shows the wrong-code message and keeps the reward unapplied", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
      "/api/checkout/loyalty/verify": () => res({ reason: "wrong" }, 400),
    });
    render(<Harness onApply={onApply} />);

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await user.type(await screen.findByLabelText("loyalty_code_label"), "000000");
    await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("loyalty_wrong_code");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows the rate-limit message when the code cannot be sent", async () => {
    const user = userEvent.setup();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ reason: "rate_limited" }, 429),
    });
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("loyalty_rate_limited");
  });

  it("keeps the buyer on the fresh list when the chosen reward is gone after verify", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
      "/api/checkout/loyalty/verify": () =>
        res({ proof: "P1", rewards: [{ id: "r5", percent: 5, label: "5% off" }] }),
    });
    render(<Harness onApply={onApply} />);

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await user.type(await screen.findByLabelText("loyalty_code_label"), "123456");
    await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("loyalty_unavailable");
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { checked: true })).toHaveAccessibleName("5% off");
    expect(screen.getByRole("button", { name: "loyalty_use" })).toBeInTheDocument();
  });

  it("clears the applied reward when the phone changes", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
      "/api/checkout/loyalty/verify": () => res({ proof: "P1", rewards: REWARDS }),
    });
    render(<Harness onClear={onClear} />);

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await user.type(await screen.findByLabelText("loyalty_code_label"), "123456");
    await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));
    await screen.findByText("loyalty_applied");

    await user.click(screen.getByRole("button", { name: "change-phone" }));
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("loyalty_applied")).not.toBeInTheDocument();
  });

  it("the rendered text never contains a name or stamp count", async () => {
    routes({
      "/api/checkout/loyalty/lookup": () =>
        res({
          status: "card",
          rewards: REWARDS,
          // The server never sends these; the UI must not render them if it did.
          name: "Maria Lopez",
          stamps: 7,
          visits: 12,
        }),
    });
    const { container } = render(<Harness />);
    await screen.findByText("loyalty_has_reward");
    expect(container.textContent).not.toMatch(/Maria|Lopez|stamp|sello|visit/i);
    expect(container.textContent).not.toMatch(/\b7\b|\b12\b/);
  });

  it("after an expired code the buyer can request a new one", async () => {
    const user = userEvent.setup();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
      "/api/checkout/loyalty/verify": () => res({ reason: "expired" }, 400),
    });
    render(<Harness />);
    const sends = () =>
      fetchMock.mock.calls.filter((c) => c[0] === "/api/checkout/loyalty/send-code").length;

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await user.type(await screen.findByLabelText("loyalty_code_label"), "123456");
    await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("loyalty_expired_code");
    expect(sends()).toBe(1);
    await user.click(screen.getByRole("button", { name: "loyalty_use" }));
    await waitFor(() => expect(sends()).toBe(2));
  });

  it("lets the buyer go back from the code step and request another code", async () => {
    const user = userEvent.setup();
    routes({
      "/api/checkout/loyalty/lookup": () => res({ status: "card", rewards: REWARDS }),
      "/api/checkout/loyalty/send-code": () => res({ sent: true }),
    });
    render(<Harness />);
    const sends = () =>
      fetchMock.mock.calls.filter((c) => c[0] === "/api/checkout/loyalty/send-code").length;

    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await screen.findByLabelText("loyalty_code_label");
    await user.click(screen.getByRole("button", { name: "loyalty_send_code" }));
    await user.click(await screen.findByRole("button", { name: "loyalty_use" }));
    await waitFor(() => expect(sends()).toBe(2));
  });
});
