import { NextResponse } from "next/server";
import { errorClass } from "@/lib/card-dates-log";

export function routeFailed(e: unknown): Response {
  console.error(JSON.stringify({ event: "card_dates_route_failed", error: errorClass(e) }));
  return NextResponse.json({ error: "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
