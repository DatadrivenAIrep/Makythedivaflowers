import { describe, it, expect, beforeEach, vi } from "vitest";
const listConversationsMock = vi.fn();
const conversationThreadMock = vi.fn();
const markReadMock = vi.fn();
vi.mock("@/lib/conversation-storage", () => ({
  listConversations: (...a: unknown[]) => listConversationsMock(...a),
  conversationThread: (...a: unknown[]) => conversationThreadMock(...a),
  markConversationRead: (...a: unknown[]) => markReadMock(...a),
}));
import { GET as listGet } from "@/app/api/admin/messages/route";
import { GET as threadGet } from "@/app/api/admin/messages/[key]/route";
import { POST as readPost } from "@/app/api/admin/messages/[key]/read/route";

beforeEach(() => {
  listConversationsMock.mockReset().mockReturnValue([{ key: "cus_1", name: "Ana" }]);
  conversationThreadMock.mockReset().mockReturnValue({ conversation: { key: "cus_1" }, thread: [{ id: "m1" }] });
});

it("lists conversations", async () => {
  expect((await (await listGet()).json()).conversations).toHaveLength(1);
});
it("returns a thread", async () => {
  const res = await threadGet(new Request("http://x"), { params: Promise.resolve({ key: "cus_1" }) });
  const d = await res.json();
  expect(d.thread).toHaveLength(1);
});
it("404s an empty unknown thread", async () => {
  conversationThreadMock.mockReturnValue({ conversation: null, thread: [] });
  const res = await threadGet(new Request("http://x"), { params: Promise.resolve({ key: "nope" }) });
  expect(res.status).toBe(404);
});

it("marks a conversation read and reports how many replies changed", async () => {
  markReadMock.mockReset().mockReturnValue(2);
  const res = await readPost(new Request("http://x", { method: "POST" }), {
    params: Promise.resolve({ key: encodeURIComponent("5165550001") }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ marked: 2 });
  expect(markReadMock).toHaveBeenCalledWith("5165550001");
});
