import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";

const getReceivables = vi.fn();
vi.mock("@/lib/order-receivables", () => ({ getReceivables: (...a: unknown[]) => getReceivables(...a) }));
const sendPaymentReminder = vi.fn();
vi.mock("@/lib/payment-reminder", () => ({ sendPaymentReminder: (...a: unknown[]) => sendPaymentReminder(...a) }));
const getOrder = vi.fn();
vi.mock("@/lib/order-storage", () => ({ getOrder: (...a: unknown[]) => getOrder(...a) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  getReceivables.mockReset(); sendPaymentReminder.mockReset(); getOrder.mockReset();
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function req(method: string, authed = true) {
  const headers: Record<string, string> = {};
  if (authed) headers.cookie = `intake_session=${signSession()}`;
  return new Request("http://x", { method, headers });
}

describe("GET /api/admin/orders/receivables", () => {
  it("401 without a session", async () => {
    const { GET } = await import("@/app/api/admin/orders/receivables/route");
    expect((await GET(req("GET", false))).status).toBe(401);
  });

  it("returns the list, uncached", async () => {
    getReceivables.mockReturnValue({ items: [{ orderId: "o1" }], totalCents: 500 });
    const { GET } = await import("@/app/api/admin/orders/receivables/route");
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ items: [{ orderId: "o1" }], totalCents: 500 });
  });
});

describe("POST /api/admin/orders/[id]/remind", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("401 without a session", async () => {
    const { POST } = await import("@/app/api/admin/orders/[id]/remind/route");
    expect((await POST(req("POST", false), ctx("o1"))).status).toBe(401);
  });

  it("404 for an unknown order", async () => {
    getOrder.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/orders/[id]/remind/route");
    expect((await POST(req("POST"), ctx("nope"))).status).toBe(404);
  });

  it("returns the reminder outcome as data, business skips included", async () => {
    getOrder.mockResolvedValue({ id: "o1" });
    sendPaymentReminder.mockResolvedValue({ ok: false, reason: "already_sent" });
    const { POST } = await import("@/app/api/admin/orders/[id]/remind/route");
    const res = await POST(req("POST"), ctx("o1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "already_sent" });
    expect(sendPaymentReminder).toHaveBeenCalledWith({ id: "o1" });
  });
});
