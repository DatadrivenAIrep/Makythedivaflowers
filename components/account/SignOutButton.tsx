"use client";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types/locale";

export function SignOutButton({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/account/sign-out", { method: "POST" });
        router.replace(`/${locale}/account`);
        router.refresh();
      }}
      className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
    >
      {label}
    </button>
  );
}
