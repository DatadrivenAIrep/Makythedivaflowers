import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SITE } from "@/data/site";
import { LocalBusinessLD } from "@/components/seo/LocalBusinessLD";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";

describe("structured data", () => {
  it("SITE has all required LocalBusiness fields", () => {
    expect(SITE.brand).toBeTruthy();
    expect(SITE.address.line1).toBeTruthy();
    expect(SITE.address.locality).toBeTruthy();
    expect(SITE.address.region).toBeTruthy();
    expect(SITE.address.postal).toBeTruthy();
    expect(SITE.phone).toBeTruthy();
    expect(SITE.email).toBeTruthy();
    expect(SITE.url).toBeTruthy();
  });

  const parseLD = () => {
    const html = renderToString(<LocalBusinessLD />);
    return JSON.parse(
      html.replace(/.*<script[^>]*>/, "").replace(/<\/script>.*/, "")
        .replace(/&quot;/g, '"')
    );
  };
  const node = (type: string) =>
    parseLD()["@graph"].find((n: { "@type": string }) => n["@type"] === type);

  it("LocalBusinessLD renders one @graph with Florist, Organization and WebSite", () => {
    const parsed = parseLD();
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual([
      "Florist",
      "Organization",
      "WebSite",
    ]);
  });

  it("Florist node carries address, geo, hours and a stable @id", () => {
    const biz = node("Florist");
    // The @id must match the one the reviews block reuses, or Google reads two
    // unrelated businesses and attaches the star rating to neither.
    expect(biz["@id"]).toBe(SITE.ld.businessId);
    expect(biz.name).toBe(SITE.merchantName);
    expect(biz.address["@type"]).toBe("PostalAddress");
    expect(biz.address.streetAddress).toBe(SITE.address.line1);
    expect(biz.telephone).toBe(SITE.phone);
    expect(biz.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: SITE.geo.lat,
      longitude: SITE.geo.lng,
    });
    expect(biz.openingHoursSpecification).toHaveLength(SITE.hours.length);
    expect(biz.openingHoursSpecification[0].dayOfWeek).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    ]);
    expect(biz.openingHoursSpecification[0].opens).toBe("09:00");
  });

  it("Florist node names every town we serve", () => {
    const biz = node("Florist");
    expect(biz.areaServed).toHaveLength(SITE.servedTowns.length);
    expect(biz.areaServed.map((a: { name: string }) => a.name)).toContain("Roslyn");
    expect(biz.areaServed[0]["@type"]).toBe("City");
  });

  it("WebSite node exposes a SearchAction pointing at the shop", () => {
    const site = node("WebSite");
    expect(site.potentialAction["@type"]).toBe("SearchAction");
    expect(site.potentialAction.target.urlTemplate).toContain("{search_term_string}");
    expect(site.publisher["@id"]).toBe(SITE.ld.orgId);
  });

  it("BreadcrumbListLD renders valid JSON-LD", () => {
    const html = renderToString(
      <BreadcrumbListLD
        items={[
          { name: "Home", href: "/en" },
          { name: "Shop", href: "/en/shop" },
        ]}
      />
    );
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"position":1');
  });

  it("BreadcrumbListLD builds full URLs from baseUrl", () => {
    const html = renderToString(
      <BreadcrumbListLD
        items={[
          { name: "Home", href: "/en" },
          { name: "Shop", href: "/en/shop" },
        ]}
        baseUrl="https://divaflowers.com"
      />
    );
    expect(html).toContain("https://divaflowers.com/en");
    expect(html).toContain("https://divaflowers.com/en/shop");
    expect(html).toContain('"position":2');
  });
});
