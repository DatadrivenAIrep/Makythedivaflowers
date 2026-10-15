import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
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

  describe("crossfade", () => {
    // A node React detaches and reinserts gets fresh computed style, so its
    // opacity transition never runs and the slide pops in instead of fading.
    function removedDuringTick(slides: TvSlide[], ticks: number): HTMLElement[] {
      render(<Showcase slides={slides} />);
      const parent = screen.getAllByTestId("tv-slide")[0].parentElement!;
      const removed: HTMLElement[] = [];
      const observer = new MutationObserver(() => {});
      observer.observe(parent, { childList: true });
      for (let t = 0; t < ticks; t++) {
        act(() => { vi.advanceTimersByTime(SLIDE_MS); });
        for (const rec of observer.takeRecords()) {
          rec.removedNodes.forEach((node) => removed.push(node as HTMLElement));
        }
      }
      observer.disconnect();
      return removed;
    }

    it("never detaches the slide that becomes current", () => {
      render(<Showcase slides={[slide("a"), slide("b"), slide("c"), slide("d")]} />);
      const parent = screen.getAllByTestId("tv-slide")[0].parentElement!;
      const observer = new MutationObserver(() => {});
      observer.observe(parent, { childList: true });
      act(() => { vi.advanceTimersByTime(SLIDE_MS); });
      const removed = observer.takeRecords().flatMap((r) => [...r.removedNodes]);
      observer.disconnect();
      expect(current()).toHaveTextContent("b EN");
      expect(removed).not.toContain(current());
    });

    it("never detaches the slide that becomes current when wrapping to the first", () => {
      const slides = [slide("a"), slide("b"), slide("c"), slide("d")];
      render(<Showcase slides={slides} />);
      act(() => { vi.advanceTimersByTime(SLIDE_MS * 3); });
      expect(current()).toHaveTextContent("d EN");
      const parent = current().parentElement!;
      const observer = new MutationObserver(() => {});
      observer.observe(parent, { childList: true });
      act(() => { vi.advanceTimersByTime(SLIDE_MS); });
      const removed = observer.takeRecords().flatMap((r) => [...r.removedNodes]);
      observer.disconnect();
      expect(current()).toHaveTextContent("a EN");
      expect(removed).not.toContain(current());
    });

    it("keeps every slide in the DOM unmoved across a whole loop of ticks", () => {
      const removed = removedDuringTick([slide("a"), slide("b"), slide("c"), slide("d"), slide("e")], 5);
      const stillMounted = screen.getAllByTestId("tv-slide");
      for (const node of removed) expect(stillMounted).not.toContain(node);
    });

    it("stacks the current slide on top regardless of DOM order", () => {
      render(<Showcase slides={[slide("a"), slide("b"), slide("c"), slide("d")]} />);
      act(() => { vi.advanceTimersByTime(SLIDE_MS); });
      expect(current().className).toContain("z-10");
      const others = screen.getAllByTestId("tv-slide").filter((el) => el !== current());
      for (const el of others) expect(el.className).not.toContain("z-10");
    });

    it("keeps the outgoing slide as prev (still zooming) with only two slides", () => {
      render(<Showcase slides={[slide("a"), slide("b")]} />);
      act(() => { vi.advanceTimersByTime(SLIDE_MS); });
      expect(current()).toHaveTextContent("b EN");
      const other = screen.getAllByTestId("tv-slide").find((el) => el !== current())!;
      expect(other.dataset.role).toBe("prev");
      expect(other.innerHTML).toContain("tv-zoom");
    });
  });

  it("blends the white logo into the plaster in both the corner and the empty state", () => {
    const { unmount } = render(<Showcase slides={[slide("a"), slide("b")]} />);
    expect(screen.getByAltText("Maky the Diva Flowers").className).toContain("mix-blend-multiply");
    unmount();
    render(<Showcase slides={[]} />);
    expect(screen.getByAltText("Maky the Diva Flowers").className).toContain("mix-blend-multiply");
  });

  it("feathers every photo into the plaster with four edge overlays sized to the photo", () => {
    render(<Showcase slides={[slide("a"), slide("b"), slide("c")]} />);
    for (const section of screen.getAllByTestId("tv-slide")) {
      const edges = within(section).getAllByTestId("tv-edge");
      expect(edges).toHaveLength(4);
      for (const edge of edges) {
        expect(edge).toHaveAttribute("aria-hidden", "true");
        expect(edge.style.background).toContain("linear-gradient");
        expect(edge.style.background).toContain("237, 232, 224");
      }
      const box = edges[0].parentElement!;
      expect(box.style.aspectRatio).toContain("1800 / 2400");
      expect(box.className).toContain("origin-bottom");
    }
  });

  it("zooms the photo box (and its edges with it), not just the image", () => {
    render(<Showcase slides={[slide("a"), slide("b"), slide("c")]} />);
    const box = within(current()).getAllByTestId("tv-edge")[0].parentElement!;
    expect(box.className).toContain("tv-zoom");
    expect(box.querySelector("img")!.className).not.toContain("tv-zoom");
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
