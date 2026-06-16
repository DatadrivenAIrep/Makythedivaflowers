import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting, deleteSetting, SETTING_GOOGLE_PLACES_KEY } from "@/lib/settings-storage";

export const runtime = "nodejs";

// The only key exposed through this route — guards against free-form key injection.
const ALLOWED_KEYS = [SETTING_GOOGLE_PLACES_KEY] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

const putSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.string(),
});

export async function GET() {
  const result: Record<string, string | null> = {};
  for (const key of ALLOWED_KEYS) {
    const raw = getSetting(key);
    // Mask the API key: show last 4 chars only so the UI can confirm it's set
    // without exposing the full secret.
    result[key] = raw ? `...${raw.slice(-4)}` : null;
  }
  return NextResponse.json(result);
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { key, value } = parsed.data;
  if (value.trim() === "") {
    deleteSetting(key);
  } else {
    setSetting(key, value.trim());
  }
  return NextResponse.json({ ok: true });
}
