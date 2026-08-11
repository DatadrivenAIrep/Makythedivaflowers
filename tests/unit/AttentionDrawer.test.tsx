import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AttentionDrawer from "@/components/admin/dashboard/AttentionDrawer";

const detail = {
  inquiry: {
    id: "c1", type: "contact", stage: "nuevo", contactName: "Luis",
    contactEmail: "l@x.com", contactPhone: "", notes: "Quiero un ramo",
    sourceChannel: "web", createdAt: "2026-05-25T13:00:00Z", updatedAt: "2026-05-25T13:00:00Z",
  },
  changes: [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    String(url).endsWith("/ack")
      ? Promise.resolve(new Response(null, { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify(detail), { status: 200 })),
  ));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("acks on open and renders the contact", async () => {
  render(<AttentionDrawer id="c1" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText("Luis")).toBeDefined());
  const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
  expect(calls.some((u) => u.endsWith("/api/admin/inquiries/c1/ack"))).toBe(true);
});

it("shows an error instead of hanging when the item can no longer be loaded (404)", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    String(url).endsWith("/ack")
      ? Promise.resolve(new Response(null, { status: 200 }))
      : Promise.resolve(new Response(null, { status: 404 })),
  ));
  render(<AttentionDrawer id="gone" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeDefined());
});
