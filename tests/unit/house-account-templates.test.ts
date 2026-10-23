import { describe, it, expect, afterEach, vi } from "vitest";
import { renderSms, emailSubject, statementUrl, pickTemplate } from "@/lib/house-account-templates";

afterEach(() => vi.unstubAllEnvs());

const vars = { number: "ST-1001", amountCents: 7050, dueDate: "2026-10-16", link: "https://x.test/s/AbCdEfGh" };

describe("renderSms", () => {
  it("statement, both languages", () => {
    expect(renderSms("statement", "es", vars)).toBe("Diva Flowers: tu estado de cuenta ST-1001 por $70.50 vence el 16 oct 2026. Ver y pagar: https://x.test/s/AbCdEfGh");
    expect(renderSms("statement", "en", vars)).toBe("Diva Flowers: your statement ST-1001 for $70.50 is due Oct 16, 2026. View and pay: https://x.test/s/AbCdEfGh");
  });
  it("reminder and overdue", () => {
    expect(renderSms("reminder", "es", vars)).toContain("Recordatorio Diva Flowers: el estado ST-1001 por $70.50 vence el 16 oct 2026.");
    expect(renderSms("overdue", "en", vars)).toContain("statement ST-1001 for $70.50 was due Oct 16, 2026. Pay here:");
    expect(renderSms("overdue", "es", { ...vars, amountCents: 7000 })).toContain("por $70 venció el");
  });
  it("never carries an opt-out footer (transactional)", () => {
    expect(renderSms("reminder", "en", vars).toUpperCase()).not.toContain("STOP");
  });
});

describe("helpers", () => {
  it("subject", () => {
    expect(emailSubject("es", "ST-1001")).toBe("Estado de cuenta ST-1001 · Diva Flowers");
    expect(emailSubject("en", "ST-1001")).toBe("Statement ST-1001 · Diva Flowers");
  });
  it("statementUrl uses NEXT_PUBLIC_SITE_URL with a fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.test/");
    expect(statementUrl("AbCdEfGh")).toBe("https://staging.test/s/AbCdEfGh");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(statementUrl("AbCdEfGh")).toBe("https://makythedivaflowers.com/s/AbCdEfGh");
  });
  it("pickTemplate", () => {
    expect(pickTemplate("statement", "2026-10-20", "2026-10-16")).toBe("statement");
    expect(pickTemplate("reminder", "2026-10-16", "2026-10-16")).toBe("reminder");
    expect(pickTemplate("reminder", "2026-10-17", "2026-10-16")).toBe("overdue");
    expect(pickTemplate("manual", "2026-10-01", "2026-10-16")).toBe("reminder");
    expect(pickTemplate("manual", "2026-11-01", "2026-10-16")).toBe("overdue");
  });
});
