import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardPolling } from "@/components/admin/dashboard/useDashboardPolling";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("polls queue + feed on mount and every 20s", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2); // queue + feed
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("pauses polling when document is hidden", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(2); // no new calls
});

it("invokes onNewOrder with ids appearing for the first time", async () => {
  const onNewOrder = vi.fn();
  let queueResp = { items: [], generatedAt: "x" };
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/queue")) return Promise.resolve(new Response(JSON.stringify(queueResp), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 }));
  });
  renderHook(() => useDashboardPolling({ intervalMs: 20_000, onNewOrder }));
  await act(async () => { await Promise.resolve(); });
  queueResp = { items: [{ orderId: "new1", reason: "web_unacknowledged", order: { id: "new1" } }], generatedAt: "y" } as never;
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(onNewOrder).toHaveBeenCalledWith(["new1"]);
});
