import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, DELETE } from "@/app/api/admin/session/route";

beforeEach(() => {
  vi.stubEnv("INTAKE_PASSWORD", "correctpass");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-32-chars-minimum-1234");
});

function req(body: unknown): Request {
  return new Request("http://localhost/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/session", () => {
  it("returns 200 + Set-Cookie on correct password", async () => {
    const res = await POST(req({ password: "correctpass" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/^intake_session=/);
    expect(cookie).toMatch(/HttpOnly/);
  });

  it("returns 401 on wrong password", async () => {
    const res = await POST(req({ password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing password", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/session", () => {
  it("clears the cookie", async () => {
    const res = await DELETE();
    expect(res.status).toBe(204);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/intake_session=;/);
    expect(cookie).toMatch(/Max-Age=0/);
  });
});
