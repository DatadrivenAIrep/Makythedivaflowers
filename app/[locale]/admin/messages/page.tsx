import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import MessagesInbox from "@/components/admin/messages/MessagesInbox";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <DashboardShell locale={locale}>
      <MessagesInbox locale={locale} />
    </DashboardShell>
  );
}
