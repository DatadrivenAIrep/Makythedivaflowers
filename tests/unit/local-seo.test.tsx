import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import {
  LOCAL_CITIES,
  LOCAL_OCCASIONS,
  LOCAL_INTERSECTIONS,
  getIntersection,
} from "@/data/local-seo";
import { buildLocalFaq } from "@/lib/seo/local-faq";
import { LocalServiceLD } from "@/components/seo/LocalServiceLD";
import { SITE } from "@/data/site";

const parse = (html: string) =>
  JSON.parse(
    html.replace(/.*<script[^>]*>/, "").replace(/<\/script>.*/, "").replace(/&quot;/g, '"'),
  );

describe("local SEO data", () => {
  it("has a unique, URL-safe slug for every city and occasion", () => {
    const citySlugs = LOCAL_CITIES.map((c) => c.slug);
    expect(new Set(citySlugs).size).toBe(citySlugs.length);
    for (const s of citySlugs) expect(s).toMatch(/^[a-z0-9-]+$/);
    const occSlugs = LOCAL_OCCASIONS.map((o) => o.slug);
    expect(new Set(occSlugs).size).toBe(occSlugs.length);
  });

  it("gives every city real ZIPs, neighbours and a distance", () => {
    for (const c of LOCAL_CITIES) {
      expect(c.zips.length).toBeGreaterThan(0);
      for (const z of c.zips) expect(z).toMatch(/^\d{5}$/);
      expect(c.neighbors.length).toBeGreaterThanOrEqual(3);
      expect(c.miles).toBeGreaterThan(0);
      expect(c.driveMinutes).toBeGreaterThan(0);
    }
  });

  // The guard that keeps this page set out of doorway-page territory: no
  // city x occasion may ship with only the shared boilerplate.
  it("has a unique intersection note for every city x occasion", () => {
    for (const c of LOCAL_CITIES) {
      for (const o of LOCAL_OCCASIONS) {
        const note = getIntersection(c.slug, o.slug);
        expect(note, `missing note for ${c.slug}:${o.slug}`).toBeDefined();
        expect(note!.en.split(" ").length).toBeGreaterThan(40);
        expect(note!.es.split(" ").length).toBeGreaterThan(40);
      }
    }
    expect(Object.keys(LOCAL_INTERSECTIONS)).toHaveLength(
      LOCAL_CITIES.length * LOCAL_OCCASIONS.length,
    );
  });

  it("never reuses the same intersection note on two pages", () => {
    const bodies = Object.values(LOCAL_INTERSECTIONS).map((n) => n.en);
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("names the town in every intersection note", () => {
    for (const c of LOCAL_CITIES) {
      for (const o of LOCAL_OCCASIONS) {
        expect(getIntersection(c.slug, o.slug)!.en).toContain(c.name);
      }
    }
  });

  it("localises everything — no English leaking into the Spanish pages", () => {
    for (const c of LOCAL_CITIES) {
      expect(c.note.es).not.toBe(c.note.en);
      for (const o of LOCAL_OCCASIONS) {
        expect(getIntersection(c.slug, o.slug)!.es).not.toBe(
          getIntersection(c.slug, o.slug)!.en,
        );
      }
    }
    for (const o of LOCAL_OCCASIONS) {
      expect(o.leadIn.es).not.toBe(o.leadIn.en);
      for (const g of o.guidance) expect(g.body.es).not.toBe(g.body.en);
    }
  });
});

describe("buildLocalFaq", () => {
  const roslyn = LOCAL_CITIES.find((c) => c.slug === "roslyn-ny")!;
  const wedding = LOCAL_OCCASIONS.find((o) => o.slug === "wedding")!;

  it("answers from the same data the page renders, so the two cannot disagree", () => {
    const faq = buildLocalFaq("en", roslyn);
    const sameDay = faq[0].a;
    expect(sameDay).toContain(String(roslyn.miles));
    expect(sameDay).toContain(String(roslyn.driveMinutes));
    expect(sameDay).toContain(SITE.cutoffTime);
    expect(faq[1].a).toContain(roslyn.zips[0]);
  });

  it("adds occasion-specific entries only when scoped to an occasion", () => {
    expect(buildLocalFaq("en", roslyn)).toHaveLength(3);
    expect(buildLocalFaq("en", roslyn, wedding)).toHaveLength(5);
  });

  it("builds a Spanish FAQ for the Spanish pages", () => {
    const es = buildLocalFaq("es", roslyn, wedding);
    expect(es[0].q).toContain("¿");
    expect(es[0].q).not.toBe(buildLocalFaq("en", roslyn, wedding)[0].q);
  });
});

describe("LocalServiceLD", () => {
  const city = LOCAL_CITIES[0];
  const occasion = LOCAL_OCCASIONS[0];

  it("emits Service + FAQPage and references the shared Florist @id", () => {
    const g = parse(renderToString(<LocalServiceLD locale="en" city={city} occasion={occasion} />));
    const [service, faq] = g["@graph"];
    expect(service["@type"]).toBe("Service");
    // A bare @id reference — repeating the business here would give Google a
    // second, competing description of the same shop.
    expect(service.provider).toEqual({ "@id": SITE.ld.businessId });
    expect(service.areaServed.name).toBe(city.name);
    expect(faq["@type"]).toBe("FAQPage");
  });

  it("keeps the schema FAQ identical to the visible one", () => {
    const g = parse(renderToString(<LocalServiceLD locale="en" city={city} occasion={occasion} />));
    const schemaQs = g["@graph"][1].mainEntity.map((q: { name: string }) => q.name);
    expect(schemaQs).toEqual(buildLocalFaq("en", city, occasion).map((f) => f.q));
  });
});
