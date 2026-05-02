import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { cardMessageRequestSchema } from "@/schemas/card-message";
import { buildCardMessagePrompt } from "@/lib/card-message-prompt";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const MAX_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;
const MAX_SUGGESTION_CHARS = 200;

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[card-message] ANTHROPIC_API_KEY missing");
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const ip = ipFromRequest(req);
  const rl = rateLimit(`card-message:${ip}`, { max: MAX_PER_HOUR, windowMs: WINDOW_MS });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = cardMessageRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { system, user } = buildCardMessagePrompt(parsed.data);
  const client = new Anthropic({ apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: string;
  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal: controller.signal },
    );
    const block = response.content.find((b: { type: string }) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    if (!block) {
      console.error("[card-message] no text block in response");
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    raw = block.text;
  } catch (err) {
    console.error("[card-message] sdk error", err);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  let suggestions: string[];
  try {
    // Strip markdown code fences if the model wraps its JSON output
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const obj = JSON.parse(cleaned);
    if (!Array.isArray(obj.suggestions) || obj.suggestions.length !== 3) {
      throw new Error("wrong shape");
    }
    suggestions = obj.suggestions.map((s: unknown) => {
      if (typeof s !== "string") throw new Error("non-string suggestion");
      return s.trim().slice(0, MAX_SUGGESTION_CHARS);
    });
  } catch (err) {
    console.error("[card-message] parse error", err, "raw=", raw);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  console.log(
    JSON.stringify({
      event: "card_message",
      occasion: parsed.data.occasion,
      relation: parsed.data.relation,
      locale: parsed.data.locale,
      ok: true,
      ts: Date.now(),
    }),
  );

  return NextResponse.json({ suggestions }, { status: 200 });
}
