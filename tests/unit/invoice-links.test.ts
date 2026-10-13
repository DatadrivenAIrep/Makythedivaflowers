import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { CODE_PATTERN } from "@/lib/short-code";
import { ensureInvoiceCode, getOrderIdByInvoiceCode, invoiceUrl } from "@/lib/invoice-links";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("invoice links", () => {
  it("allocates an 8-char code once per order and reuses it", () => {
    const a = ensureInvoiceCode("ord_a");
    expect(a).toMatch(CODE_PATTERN);
    expect(ensureInvoiceCode("ord_a")).toBe(a);
    expect(ensureInvoiceCode("ord_b")).not.toBe(a);
  });

  it("resolves a code back to its order, null for unknown", () => {
    const code = ensureInvoiceCode("ord_a");
    expect(getOrderIdByInvoiceCode(code)).toBe("ord_a");
    expect(getOrderIdByInvoiceCode("ZZZZZZZZ")).toBeNull();
  });

  it("builds the public URL on the site domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.test/");
    expect(invoiceUrl("AbCdEfGh")).toBe("https://x.test/i/AbCdEfGh");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(invoiceUrl("AbCdEfGh")).toBe("https://makythedivaflowers.com/i/AbCdEfGh");
  });
});
