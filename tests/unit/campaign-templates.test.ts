import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_TEMPLATES,
  CAMPAIGN_TEMPLATE_CATEGORIES,
  type CampaignTemplateCategory,
} from "@/data/campaign-templates";

const VALID_CATEGORIES = new Set<CampaignTemplateCategory>(
  CAMPAIGN_TEMPLATE_CATEGORIES.map((c) => c.key),
);

// The renderer appends the opt-out footer itself, so no template body may carry
// opt-out keywords — that would double up (and "Reply STOP" inside a marketing
// body reads as a mixed signal). Matches whole words only.
const OPT_OUT = /\b(stop|stopall|unsubscribe|cancel|baja|reply stop|responde stop)\b/i;

describe("campaign templates", () => {
  it("has a healthy library size", () => {
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("every template has both bodies, both labels, a valid category, and an icon", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.bodyEs.trim().length, `${t.id} bodyEs`).toBeGreaterThan(0);
      expect(t.bodyEn.trim().length, `${t.id} bodyEn`).toBeGreaterThan(0);
      expect(t.label.es.trim().length, `${t.id} label.es`).toBeGreaterThan(0);
      expect(t.label.en.trim().length, `${t.id} label.en`).toBeGreaterThan(0);
      expect(t.icon.trim().length, `${t.id} icon`).toBeGreaterThan(0);
      expect(VALID_CATEGORIES.has(t.category), `${t.id} category`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = CAMPAIGN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no body contains opt-out / STOP keywords (the footer is auto-appended)", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(OPT_OUT.test(t.bodyEs), `${t.id} bodyEs has opt-out text`).toBe(false);
      expect(OPT_OUT.test(t.bodyEn), `${t.id} bodyEn has opt-out text`).toBe(false);
    }
  });

  it("uses the {nombre} token on some templates but not all", () => {
    const withToken = CAMPAIGN_TEMPLATES.filter((t) => t.bodyEs.includes("{nombre}"));
    expect(withToken.length).toBeGreaterThan(0);
    expect(withToken.length).toBeLessThan(CAMPAIGN_TEMPLATES.length);
  });
});
