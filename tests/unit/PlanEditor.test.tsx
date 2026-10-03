import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import PlanEditor from "@/components/admin/accounts/PlanEditor";
import type { HouseAccount } from "@/types/house-account";

const account: HouseAccount = {
  id: "ha_1", name: "Hotel Roslyn", locale: "es", cadence: "monthly", issueDay: 1, termsDays: 15,
  reminderPlan: [{ offsetDays: -3, channel: "sms" }], statementChannel: "both", status: "active",
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);
}

describe("PlanEditor reminders", () => {
  it("keeps a before-row on 'before' while its days field is cleared, and saves the clamped negative offset", () => {
    const onSave = vi.fn(async () => true);
    wrap(<PlanEditor account={account} busy={false} onSave={onSave} />);
    const days = screen.getByLabelText("Cantidad de días") as HTMLInputElement;
    const when = screen.getByLabelText("Cuándo enviar el recordatorio") as HTMLSelectElement;
    fireEvent.change(days, { target: { value: "" } });
    expect(when.value).toBe("before");
    expect(days.disabled).toBe(false);
    fireEvent.change(days, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0] as unknown[])[0]).toMatchObject({ reminderPlan: [{ offsetDays: -5, channel: "sms" }] });
  });

  it("saves an emptied before-row as one day before, never as the due date", () => {
    const onSave = vi.fn(async () => true);
    wrap(<PlanEditor account={account} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Cantidad de días"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect((onSave.mock.calls[0] as unknown[])[0]).toMatchObject({ reminderPlan: [{ offsetDays: -1 }] });
  });

  it("shows the clamped value on blur and when the direction changes", () => {
    wrap(<PlanEditor account={account} busy={false} onSave={vi.fn(async () => true)} />);
    const days = screen.getByLabelText("Cantidad de días") as HTMLInputElement;
    const when = screen.getByLabelText("Cuándo enviar el recordatorio") as HTMLSelectElement;
    fireEvent.change(days, { target: { value: "100" } });
    expect(days.value).toBe("100");
    fireEvent.blur(days);
    expect(days.value).toBe("60");
    fireEvent.change(days, { target: { value: "" } });
    fireEvent.blur(days);
    expect(days.value).toBe("1");
    fireEvent.change(when, { target: { value: "after" } });
    fireEvent.change(days, { target: { value: "100" } });
    fireEvent.blur(days);
    expect(days.value).toBe("100");
    fireEvent.change(when, { target: { value: "before" } });
    expect(days.value).toBe("60");
  });
});
