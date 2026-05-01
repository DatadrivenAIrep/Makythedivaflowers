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

  it("LocalBusinessLD renders valid JSON-LD", () => {
    const html = renderToString(<LocalBusinessLD />);
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain(SITE.brand);
    expect(html).toContain('"@context":"https://schema.org"');
  });

  it("LocalBusinessLD includes address fields", () => {
    const html = renderToString(<LocalBusinessLD />);
    const parsed = JSON.parse(
      html.replace(/.*<script[^>]*>/, "").replace(/<\/script>.*/, "")
        .replace(/&quot;/g, '"')
    );
    expect(parsed["@type"]).toBe("LocalBusiness");
    expect(parsed.name).toBe(SITE.brand);
    expect(parsed.address["@type"]).toBe("PostalAddress");
    expect(parsed.address.streetAddress).toBe(SITE.address.line1);
    expect(parsed.telephone).toBe(SITE.phone);
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
