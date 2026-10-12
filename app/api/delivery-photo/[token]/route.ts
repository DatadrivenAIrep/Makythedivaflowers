import { readDeliveryPhotoByToken } from "@/lib/delivery-photos";

export const runtime = "nodejs";

// Public on purpose: Twilio fetches this for the MMS without our session.
// The 128-bit token is the access control; unknown and malformed tokens get
// the same 404 so nothing distinguishes them.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await ctx.params;
  const data = readDeliveryPhotoByToken(token);
  if (!data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
