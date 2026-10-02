import { NextResponse } from "next/server";
import { getAccount, linkContact, unlinkContact, listContacts } from "@/lib/house-account-storage";
import { contactBody } from "@/schemas/house-account";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function parse(req: Request) {
  return contactBody.safeParse(await req.json().catch(() => null));
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!getAccount(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = await parse(req);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    linkContact(id, parsed.data.customerId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "customer_not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "contact_taken") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ contacts: listContacts(id) });
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = await parse(req);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  unlinkContact(id, parsed.data.customerId);
  return NextResponse.json({ contacts: listContacts(id) });
}
