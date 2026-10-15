import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Showcase, { SLIDE_MS, REFRESH_MS } from "@/components/tv-showcase/Showcase";
import type { TvSlide } from "@/lib/tv-showcase";

function slide(id: string): TvSlide {
  return {
    id, slug: id, src: `/products/${id}.jpg`, width: 1800, height: 2400,
    nameEn: `${id} EN`, nameEs: `${id} ES`,
    price: { en: "From $85", es: "Desde $85" },
    url: `https://x/en/product/${id}`, qr: "data:image/svg+xml;base64,AAAA",
  };
}

function current() {
  return screen.getAllByTestId("tv-slide").find((el) => el.dataset.role === "current")!;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Showcase", () => {
  it("shows the first slide with both names and both price lines", () => {
    render(<Showcase slides={[slide("a"), slide("b"), slide("c")]} />);
    expect(current()).toHaveTextContent("a EN");
    expect(current()).toHaveTextContent("a ES");
    expect(current()).toHaveTextContent("From $85");
    expect(current()).toHaveTextContent("Desde $85");
  });

  it("mounts the next slide ahead of time so its photo preloads", () => {
    render(<Showcase slides={[slide("a"), slide("b"), slide("c"), slide("d")]} />);
    const roles = screen.getAllByTestId("tv-slide").map((el) => el.dataset.role).sort();
    expect(roles).toEqual(["current", "next", "prev"]);
    expect(screen.getAllByTestId("tv-slide").find((el) => el.dataset.role === "next")).toHaveTextContent("b EN");
  });

  it("advances every SLIDE_MS and loops", () => {
    render(<Showcase slides={[slide("a"), slide("b"), slide("c")]} />);
    act(() => { vi.advanceTimersByTime(SLIDE_MS); });
    expect(current()).toHaveTextContent("b EN");
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 2); });
    expect(current()).toHaveTextContent("a EN");
  });

  it("reloads after REFRESH_MS only when the site answers", async () => {
    const reload = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<Showcase slides={[slide("a"), slide("b")]} reload={reload} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS); });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads with the default reload while the slides keep advancing", async () => {
    // The default `reload` is a new function on every render; slide changes must
    // not reset the 30-minute refresh timer.
    const reloadSpy = vi.fn();
    vi.stubGlobal("location", { href: "http://localhost/vitrina", reload: reloadSpy });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<Showcase slides={[slide("a"), slide("b"), slide("c")]} />);
    // One act per slide so React really re-renders between ticks (a single big
    // act would batch the updates and hide the bug).
    for (let t = 0; t < REFRESH_MS; t += SLIDE_MS) {
      await act(async () => { await vi.advanceTimersByTimeAsync(SLIDE_MS); });
    }
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps running when the network is down", async () => {
    const reload = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<Showcase slides={[slide("a"), slide("b")]} reload={reload} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS); });
    expect(reload).not.toHaveBeenCalled();
    expect(current()).toBeInTheDocument();
  });

  it("shows the logo instead of an empty screen when there are no slides", () => {
    render(<Showcase slides={[]} />);
    expect(screen.queryAllByTestId("tv-slide")).toHaveLength(0);
    expect(screen.getByAltText("Maky the Diva Flowers")).toBeInTheDocument();
  });
});
