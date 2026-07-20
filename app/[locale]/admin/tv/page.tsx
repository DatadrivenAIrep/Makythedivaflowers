import TvBoard from "@/components/admin/tv/TvBoard";

export const dynamic = "force-dynamic";

// The board UI is Spanish-only (internal kiosk); locale is consumed by the
// layout's auth redirect. If i18n is ever needed here, add setRequestLocale +
// next-intl per node_modules/next docs (see AGENTS.md — Next 16 differs).
export default async function TvPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return <TvBoard />;
}
