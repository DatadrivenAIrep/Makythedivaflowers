// lib/seasonal-picks.ts
//
// The "What are you looking for?" chips right under the home hero: the few
// things customers actually ask for by name ("roses", "something for fall",
// "something for Thanksgiving"), with the running season up front. Like the
// occasion strip, the list is a function of the date, so a season never has
// to be switched on or off by hand.
import { seasonalLink, EXOTIC_LINK } from "@/lib/occasions-nav";
import { thanksgiving } from "@/lib/hero-season";
import { shopDateStr } from "@/lib/tv-slots";

export type SeasonalPick = {
  slug: string;
  label: { en: string; es: string };
  /** Cover photo of an active piece in the linked collection (a test checks it). */
  img: string;
  path: (locale: string) => string;
  /** Small line over the label: "Season", or the holiday's date. */
  badge?: { en: string; es: string };
};

/** Always listed, after the seasonal ones. */
export const EVERGREEN_PICKS: SeasonalPick[] = [
  {
    slug: "roses",
    label: { en: "Roses", es: "Rosas" },
    img: "/products/hundred-roses.jpg",
    path: (l) => `/${l}/shop/roses`,
  },
  // The "can't decide?" way in: Maky picks the stems. Second so it shows on
  // the first swipe on phones.
  {
    slug: "designers-choice",
    label: { en: "Let Maky choose", es: "Que Maky elija" },
    img: "/products/designers-choice-maky.jpg",
    path: (l) => `/${l}/product/designers-choice-maky`,
  },
  {
    slug: "centerpieces",
    label: { en: "Centerpieces", es: "Centros de mesa" },
    img: "/products/garden-party.jpg",
    path: (l) => `/${l}/shop/centerpieces`,
  },
  {
    slug: EXOTIC_LINK.slug,
    label: EXOTIC_LINK.label,
    img: EXOTIC_LINK.img,
    path: EXOTIC_LINK.path,
  },
  {
    slug: "sympathy",
    label: { en: "Sympathy", es: "Condolencias" },
    img: "/products/celestial-peace.jpg",
    path: (l) => `/${l}/sympathy`,
  },
];

/**
 * Thanksgiving has no collection of its own: people want something for the
 * table, so it opens the centerpieces (the harvest pieces are among them).
 */
export const THANKSGIVING_IMG = "/products/harvest-table.jpg";

const SEASON_BADGE = { en: "Season", es: "Temporada" };

/** "Thu, Nov 26" / "Jue 26 nov" for a YYYY-MM-DD date. */
function holidayBadge(iso: string): { en: string; es: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  const en = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const es = d.toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return { en, es: es.replace(/\./g, "").replace(",", "").replace(/^./, (c) => c.toUpperCase()) };
}

export function seasonalPicks(now: Date = new Date()): SeasonalPick[] {
  const today = shopDateStr(now); // YYYY-MM-DD, sortable as a string
  const year = Number(today.slice(0, 4));
  const picks: SeasonalPick[] = [];

  const season = seasonalLink(now);
  if (season) picks.push({ ...season, badge: SEASON_BADGE });

  // From mid-October, when the dinner orders start, through the day itself.
  const turkeyDay = thanksgiving(year);
  if (today >= `${year}-10-15` && today <= turkeyDay) {
    picks.push({
      slug: "thanksgiving",
      label: { en: "Thanksgiving", es: "Thanksgiving" },
      img: THANKSGIVING_IMG,
      path: (l) => `/${l}/shop/centerpieces`,
      badge: holidayBadge(turkeyDay),
    });
  }

  return [...picks, ...EVERGREEN_PICKS];
}
