// components/admin/accounts/AccountStatusBadge.tsx
"use client";
import { useTranslations } from "next-intl";
import type { AccountStatus } from "@/types/house-account";

const CLS: Record<AccountStatus, string> = {
  active: "bg-emerald-600/10 text-emerald-700",
  paused: "bg-amber-500/15 text-amber-700",
  closed: "bg-ink/10 text-ink/50",
};

export default function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const t = useTranslations("admin_accounts");
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${CLS[status]}`}>{t(`status_${status}`)}</span>;
}
