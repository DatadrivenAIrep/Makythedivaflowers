import { NextResponse } from "next/server";

/** An error text safe to log: quoted fragments (V8 quotes stored card text) are dropped. */
export function safeErrorText(e: unknown): string {
  if (!(e instanceof Error)) return "unknown";
  const stripped = e.message.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "").trim();
  return stripped || e.name;
}

export function routeFailed(e: unknown): Response {
  console.error(JSON.stringify({ event: "card_dates_route_failed", error: safeErrorText(e) }));
  return NextResponse.json({ error: "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
