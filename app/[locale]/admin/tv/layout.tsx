import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function TvLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!verifySession(token)) {
    redirect(`/${locale}/admin/login?next=/${locale}/admin/tv`);
  }
  return <div className="min-h-screen overflow-hidden bg-bone text-ink">{children}</div>;
}
