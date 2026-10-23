import { NextResponse } from "next/server";
import { searchAccounts } from "@/lib/house-account-storage";
export const runtime = "nodejs";
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ accounts: searchAccounts(q) });
}
