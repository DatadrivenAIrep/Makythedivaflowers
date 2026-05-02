import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

beforeEach(() => {
  __resetRateLimitForTests();
  createMock.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const validBody = {
  productTitle: "Timeless Romance",
  occasion: "anniversary",
  relation: "partner",
  locale: "en",
};

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/card-message", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/card-message", () => {
  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq({ bogus: 1 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_input");
  });

  it("returns 400 on non-JSON body", async () => {
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(
      new Request("http://localhost/api/card-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with three suggestions on happy path", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            suggestions: ["one one one", "two two two", "three three three"],
          }),
        },
      ],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestions).toEqual(["one one one", "two two two", "three three three"]);
  });

  it("trims and caps each suggestion to 200 chars", async () => {
    const long = "x".repeat(250);
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ suggestions: ["  hi  ", long, "ok"] }),
        },
      ],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    const json = await res.json();
    expect(json.suggestions[0]).toBe("hi");
    expect(json.suggestions[1].length).toBe(200);
    expect(json.suggestions[2]).toBe("ok");
  });

  it("returns 502 on malformed JSON from model", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "not json at all" }] });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("upstream");
  });

  it("returns 502 when array has wrong length", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b"] }) }],
    });
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("returns 502 when SDK throws", async () => {
    createMock.mockRejectedValue(new Error("network"));
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("returns 429 on rate limit exceeded", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b", "c"] }) }],
    });
    const { POST } = await import("@/app/api/card-message/route");
    for (let i = 0; i < 20; i++) {
      const ok = await POST(makeReq(validBody));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeReq(validBody));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("rate_limit");
  });

  it("returns 502 when ANTHROPIC_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { POST } = await import("@/app/api/card-message/route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(502);
  });

  it("logs anonymous telemetry on success without IP or content", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["a", "b", "c"] }) }],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { POST } = await import("@/app/api/card-message/route");
    await POST(makeReq(validBody));
    const calls = logSpy.mock.calls.flat().join(" ");
    expect(calls).toContain("card_message");
    expect(calls).toContain("anniversary");
    expect(calls).toContain("partner");
    expect(calls).toContain("en");
    expect(calls).not.toContain("9.9.9.9");
    expect(calls).not.toContain("Timeless Romance");
    logSpy.mockRestore();
  });
});
