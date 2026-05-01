// data/delivery-zones.ts
export type DeliveryZone = {
  id: string;
  label: { en: string; es: string };
  zips: string[];
};

export const deliveryZones: DeliveryZone[] = [
  { id: "nassau-south", label: { en: "South Nassau", es: "Sur de Nassau" },
    zips: ["11010", "11020", "11030", "11040", "11050", "11507", "11530", "11542", "11550", "11552", "11557", "11558", "11561", "11565", "11572", "11580", "11598"] },
  { id: "nassau-north", label: { en: "North Nassau", es: "Norte de Nassau" },
    zips: ["11021", "11023", "11024", "11030", "11050", "11576", "11577"] },
  { id: "queens", label: { en: "Queens", es: "Queens" },
    zips: ["11354", "11355", "11356", "11357", "11358", "11361", "11364", "11365", "11366", "11375", "11385", "11411", "11412", "11422", "11427", "11428", "11429"] },
  { id: "suffolk-west", label: { en: "Western Suffolk", es: "Suffolk occidental" },
    zips: ["11704", "11717", "11722", "11729", "11738", "11740", "11743", "11746", "11747", "11754"] },
];
