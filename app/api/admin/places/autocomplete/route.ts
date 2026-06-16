import { NextResponse } from "next/server";
import { getSetting, SETTING_GOOGLE_PLACES_KEY } from "@/lib/settings-storage";

export const runtime = "nodejs";

export type PlacesSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("input")?.trim() ?? "";
  if (!input || input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = getSetting(SETTING_GOOGLE_PLACES_KEY);
  if (!apiKey) {
    return NextResponse.json({ suggestions: [], error: "no_api_key" }, { status: 200 });
  }

  const params = new URLSearchParams({
    input,
    key: apiKey,
    components: "country:us",
    language: "es",
    types: "address",
    // Bias results toward Long Island / NYC area
    location: "40.7282,-73.7949",
    radius: "50000",
  });

  const googleRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
  );
  if (!googleRes.ok) {
    return NextResponse.json({ suggestions: [], error: "google_error" }, { status: 200 });
  }

  const data = (await googleRes.json()) as {
    status: string;
    predictions: {
      place_id: string;
      description: string;
      structured_formatting: { main_text: string; secondary_text: string };
    }[];
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ suggestions: [], error: data.status }, { status: 200 });
  }

  const suggestions: PlacesSuggestion[] = (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting.main_text,
    secondaryText: p.structured_formatting.secondary_text,
  }));

  return NextResponse.json({ suggestions });
}
