// tests/unit/wedding-faq-ld.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WeddingFaqLD } from "@/components/seo/WeddingFaqLD";
import { weddingFAQ } from "@/data/wedding-faq";

function parseLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "{}");
}

describe("WeddingFaqLD", () => {
  it("emits a FAQPage with one entry per FAQ (EN)", () => {
    const { container } = render(<WeddingFaqLD locale="en" />);
    const ld = parseLd(container);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(weddingFAQ.length);
    expect(ld.mainEntity[0]["@type"]).toBe("Question");
    expect(ld.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(ld.mainEntity[0].name).toBe(weddingFAQ[0].q.en);
  });

  it("uses the ES answer text for locale es", () => {
    const { container } = render(<WeddingFaqLD locale="es" />);
    const ld = parseLd(container);
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe(weddingFAQ[0].a.es);
  });
});
