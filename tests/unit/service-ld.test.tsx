// tests/unit/service-ld.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ServiceLD } from "@/components/seo/ServiceLD";

function parseLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "{}");
}

describe("ServiceLD", () => {
  it("emits a Service schema with provider, areaServed, and no price", () => {
    const { container } = render(
      <ServiceLD
        name="Wedding Florals"
        description="Full-service wedding florals on Long Island."
        serviceType="Wedding Florals"
      />,
    );
    const ld = parseLd(container);
    expect(ld["@type"]).toBe("Service");
    expect(ld.name).toBe("Wedding Florals");
    expect(ld.serviceType).toBe("Wedding Florals");
    expect(ld.provider["@type"]).toBe("LocalBusiness");
    expect(ld.provider.name).toBe("Diva Flowers");
    expect(Array.isArray(ld.areaServed)).toBe(true);
    expect(JSON.stringify(ld)).not.toMatch(/price|offer/i);
  });
});
