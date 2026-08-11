import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardPolling } from "@/components/admin/dashboard/useDashboardPolling";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("polls queue + feed + attention on mount and every 20s", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(3); // queue + feed + attention
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(6);
});

it("pauses polling when document is hidden", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], events: [], generatedAt: "x" }), { status: 200 }),
  );
  renderHook(() => useDashboardPolling({ intervalMs: 20_000 }));
  await act(async () => { await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(fetchMock).toHaveBeenCalledTimes(3); // no new calls
});

it("invokes onNewItem with attention ids appearing for the first time", async () => {
  const onNewItem = vi.fn();
  let attentionResp = { items: [] as { id: string }[], generatedAt: "x" };
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/attention")) return Promise.resolve(new Response(JSON.stringify(attentionResp), { status: 200 }));
    if (url.includes("/queue")) return Promise.resolve(new Response(JSON.stringify({ items: [], generatedAt: "x" }), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 }));
  });
  renderHook(() => useDashboardPolling({ intervalMs: 20_000, onNewItem }));
  await act(async () => { await Promise.resolve(); });
  attentionResp = { items: [{ id: "new1" }], generatedAt: "y" };
  await act(async () => { vi.advanceTimersByTime(20_000); await Promise.resolve(); });
  expect(onNewItem).toHaveBeenCalledWith(["new1"]);
});
