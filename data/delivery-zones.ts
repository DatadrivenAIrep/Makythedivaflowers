// data/delivery-zones.ts
//
// Pricing model from owner's reference card (2026-05-06):
//   Albertson $10 · Roslyn $15 · Manhasset $18 · Great Neck $25 · Port Washington $15
//   Anywhere further $25–$30 (e.g. Garden City, Mineola, Forest Hills, Queens, Suffolk).
//
// `priceCents` is the anchor price shown to the customer. `priceCentsMax`, when
// present, signals a range (e.g. "$25–$30") for zones whose final fee depends
// on the destination address within the zone.
export type DeliveryZone = {
  id: string;
  label: { en: string; es: string };
  zips: string[];
  priceCents: number;
  priceCentsMax?: number;
};

export const deliveryZones: DeliveryZone[] = [
  {
    id: "albertson",
    label: { en: "Albertson", es: "Albertson" },
    zips: ["11507"],
    priceCents: 1000,
  },
  {
    id: "roslyn",
    label: { en: "Roslyn", es: "Roslyn" },
    zips: ["11576", "11577"],
    priceCents: 1500,
  },
  {
    id: "manhasset",
    label: { en: "Manhasset", es: "Manhasset" },
    zips: ["11030"],
    priceCents: 1800,
  },
  {
    id: "great-neck",
    label: { en: "Great Neck", es: "Great Neck" },
    zips: ["11020", "11021", "11023", "11024"],
    priceCents: 2500,
  },
  {
    id: "port-washington",
    label: { en: "Port Washington", es: "Port Washington" },
    zips: ["11050"],
    priceCents: 1500,
  },
  {
    id: "further",
    label: { en: "Nassau / Queens / W. Suffolk", es: "Nassau / Queens / Oeste de Suffolk" },
    zips: [
      // Nassau (not in named cities above)
      "11010", "11040", "11501", "11530", "11542", "11550", "11552",
      "11557", "11558", "11561", "11565", "11572", "11580", "11598",
      // Queens
      "11354", "11355", "11356", "11357", "11358", "11361", "11364",
      "11365", "11366", "11375", "11385", "11411", "11412", "11422",
      "11427", "11428", "11429",
      // Western Suffolk
      "11704", "11717", "11722", "11729", "11738", "11740", "11743",
      "11746", "11747", "11754",
    ],
    priceCents: 2500,
    priceCentsMax: 3000,
  },
];
