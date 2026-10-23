import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MessagesInbox from "@/components/admin/messages/MessagesInbox";
import { SMS_READ_EVENT } from "@/components/admin/dashboard/useUnreadSmsCount";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const conv = {
  key: "cus_1", name: "Ana", phone: "5165550001", lastAt: new Date().toISOString(),
  lastPreview: "¿tienen rosas?", lastDirection: "in", count: 2, unread: 1,
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  let read = false; // server state: flips once the read POST lands
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/messages") return Response.json({ conversations: [{ ...conv, unread: read ? 0 : 1 }] });
    if (url.endsWith("/read") && init?.method === "POST") { read = true; return Response.json({ marked: 1 }); }
    return Response.json({ conversation: conv, thread: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("MessagesInbox unread", () => {
  it("dots an unread conversation, and opening it marks it read + pings the badge", async () => {
    const onRead = vi.fn();
    window.addEventListener(SMS_READ_EVENT, onRead);
    render(<MessagesInbox locale="es" />);

    expect(await screen.findByLabelText("unread")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ana"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/messages/cus_1/read", { method: "POST" }),
    );
    await waitFor(() => expect(onRead).toHaveBeenCalled());
    expect(screen.queryByLabelText("unread")).toBeNull();
    window.removeEventListener(SMS_READ_EVENT, onRead);
  });

  it("a deep link marks read, and a slow stale first list load can't bring the dot back", async () => {
    window.history.pushState({}, "", "/es/admin/messages?c=cus_1");
    let releaseFirst: (r: Response) => void = () => {};
    let listCalls = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/messages") {
        listCalls++;
        // First load is slow and predates the read; later loads see it read.
        if (listCalls === 1) return new Promise<Response>((r) => { releaseFirst = r; });
        return Promise.resolve(Response.json({ conversations: [{ ...conv, unread: 0 }] }));
      }
      if (url.endsWith("/read") && init?.method === "POST") return Promise.resolve(Response.json({ marked: 1 }));
      return Promise.resolve(Response.json({ conversation: conv, thread: [] }));
    });

    render(<MessagesInbox locale="es" />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/messages/cus_1/read", { method: "POST" }),
    );
    await waitFor(() => expect(listCalls).toBe(2));
    releaseFirst(Response.json({ conversations: [conv] })); // stale: unread 1
    expect(await screen.findAllByText("Ana")).not.toHaveLength(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByLabelText("unread")).toBeNull();
    window.history.pushState({}, "", "/");
  });

  it("does not POST read for a conversation with nothing unread", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/admin/messages"
        ? Response.json({ conversations: [{ ...conv, unread: 0 }] })
        : Response.json({ conversation: conv, thread: [] }),
    );
    render(<MessagesInbox locale="es" />);
    fireEvent.click(await screen.findByText("Ana"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/messages/cus_1"));
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/read"))).toBe(false);
  });
});
