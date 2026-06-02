// app/[locale]/prom/page.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";

export default async function PromPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/corsages-boutonnieres`);
}
