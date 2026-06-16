import { NextResponse } from "next/server";
import { getSetting, SETTING_GOOGLE_PLACES_KEY } from "@/lib/settings-storage";
import type { Address } from "@/types/address";

export const runtime = "nodejs";

type AddressComponent = { long_name: string; short_name: string; types: string[] };

function extract(components: AddressComponent[], ...types: string[]): string {
  return (
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? ""
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) return NextResponse.json({ error: "no_place_id" }, { status: 400 });

  const apiKey = getSetting(SETTING_GOOGLE_PLACES_KEY);
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 200 });

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: "address_component",
    language: "es",
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
  );
  if (!res.ok) return NextResponse.json({ error: "google_error" }, { status: 200 });

  const data = (await res.json()) as {
    status: string;
    result?: { address_components: AddressComponent[] };
  };

  if (data.status !== "OK" || !data.result) {
    return NextResponse.json({ error: data.status }, { status: 200 });
  }

  const c = data.result.address_components;
  const address: Address = {
    street1: [extract(c, "street_number"), extract(c, "route")].filter(Boolean).join(" "),
    city: extract(c, "locality", "sublocality", "neighborhood"),
    state: extract(c, "administrative_area_level_1") || "NY",
    zip: extract(c, "postal_code"),
    country: "US",
  };

  return NextResponse.json({ address });
}
