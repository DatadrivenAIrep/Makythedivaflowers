import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import SendsQueue from "@/components/admin/accounts/SendsQueue";
import type { ScheduledSend } from "@/types/house-account";

const send: ScheduledSend = {
  id: "s1", accountId: "ha_1", statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms",
  scheduledFor: "2099-01-10", status: "scheduled", createdAt: "2026-10-01T13:00:00Z",
};

function setup(onAction: (...a: unknown[]) => Promise<boolean>) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      <SendsQueue locale="es" sends={[send]} statements={{ hst_1: { number: "ST-1001", dueDate: "2099-01-13" } }} busy={false}
        onAction={onAction as never} />
    </NextIntlClientProvider>,
  );
}

describe("SendsQueue reschedule", () => {
  it("opens a date editor, blocks an empty date, and reports a valid one", async () => {
    const onAction = vi.fn(async () => true);
    setup(onAction);
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    const input = screen.getByLabelText("Nueva fecha") as HTMLInputElement;
    const apply = screen.getByRole("button", { name: "Aplicar" }) as HTMLButtonElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(apply.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "2099-02-01" } });
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(onAction).toHaveBeenCalledWith("s1", "reschedule", "2099-02-01"));
    await waitFor(() => expect(screen.queryByLabelText("Nueva fecha")).toBeNull());
  });

  it("keeps the editor open with the picked date when the request fails", async () => {
    const onAction = vi.fn(async () => false);
    setup(onAction);
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    fireEvent.change(screen.getByLabelText("Nueva fecha"), { target: { value: "2099-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect((screen.getByLabelText("Nueva fecha") as HTMLInputElement).value).toBe("2099-02-01");
  });
});
