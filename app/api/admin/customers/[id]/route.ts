import { NextResponse } from "next/server";
import { getCustomerProfile } from "@/lib/customer-profile";
import { getCustomerById, updateCustomer } from "@/lib/customer-storage";
import { customerPatchSchema } from "@/schemas/customer-patch";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const profile = getCustomerProfile(id);
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = customerPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const customer = updateCustomer(id, parsed.data);
  return NextResponse.json({ customer });
}
