"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

export function TextMakyInlineLink({ className }: Props) {
  const t = useTranslations("text_modal");
  const { setOpen } = useContactContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center font-mono text-[13px] underline-offset-4 transition-colors hover:text-petal hover:underline focus-visible:outline-none focus-visible:underline",
        className,
      )}
    >
      {t("inline_link")}
    </button>
  );
}
