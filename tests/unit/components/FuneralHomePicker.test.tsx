import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import FuneralHomePicker from "@/components/admin/intake/FuneralHomePicker";
import type { Address } from "@/types/address";

afterEach(() => vi.restoreAllMocks());

const WILLIAMS: Address = { street1: "200 Willis Ave", city: "Mineola", state: "NY", zip: "11501", country: "US" };
const ROSLYN: Address = { street1: "55 Main St", city: "Roslyn", state: "NY", zip: "11576", country: "US" };
const EMPTY: Address = { street1: "", city: "", state: "NY", zip: "", country: "US" };

function mockApi(snapshot: unknown, after?: unknown) {
  return vi.spyOn(global, "fetch").mockImplementation(async (_u, init) =>
    new Response(JSON.stringify(init?.method && after ? after : snapshot), { status: init?.method === "POST" ? 201 : 200 }),
  );
}

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>,
  );
}

describe("FuneralHomePicker", () => {
  it("fills the address from a saved funeral home or a past funeral address", async () => {
    mockApi({
      homes: [{ id: "fh_1", name: "Williams Funeral Home", address: WILLIAMS }],
      recent: [{ address: ROSLYN, orderCount: 2, lastDate: "2026-06-01" }],
    });
    const onPick = vi.fn();
    wrap(<FuneralHomePicker address={EMPTY} onPick={onPick} />);
    fireEvent.click(await screen.findByText("Williams Funeral Home"));
    expect(onPick).toHaveBeenLastCalledWith(WILLIAMS);
    fireEvent.click(screen.getByText("55 Main St"));
    expect(onPick).toHaveBeenLastCalledWith(ROSLYN);
    expect(screen.getByText("×2")).toBeDefined();
  });

  it("marks the funeral home already on the order and does not offer to save it again", async () => {
    mockApi({ homes: [{ id: "fh_1", name: "Williams Funeral Home", address: WILLIAMS }], recent: [] });
    wrap(<FuneralHomePicker address={{ ...WILLIAMS, street1: "200 WILLIS AVE." }} onPick={() => {}} />);
    expect(await screen.findByText("✓ Williams Funeral Home")).toBeDefined();
    expect(screen.queryByText("Guardar funeraria")).toBeNull();
  });

  it("saves the typed address under a name", async () => {
    const fetchSpy = mockApi(
      { homes: [], recent: [] },
      { homes: [{ id: "fh_2", name: "Austin F. Knowles", address: ROSLYN }], recent: [] },
    );
    wrap(<FuneralHomePicker address={ROSLYN} onPick={() => {}} />);
    await screen.findByText(/Aún no hay funerarias guardadas/);
    fireEvent.change(screen.getByLabelText("Nombre de la funeraria (para guardarla)"), { target: { value: "Austin F. Knowles" } });
    fireEvent.click(screen.getByText("Guardar funeraria"));
    await waitFor(() => expect(screen.getByText("✓ Austin F. Knowles")).toBeDefined());
    const post = fetchSpy.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ name: "Austin F. Knowles", address: ROSLYN });
  });
});
