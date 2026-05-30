import type { Icon } from "@phosphor-icons/react";

type Variant = "primary" | "secondary" | "danger" | "dangerSolid";

const VARIANT: Record<Variant, string> = {
  primary: "bg-rouge text-bone hover:bg-rouge/90 disabled:opacity-40",
  secondary: "border border-ink/20 bg-bone text-ink hover:bg-ink/5 disabled:opacity-40",
  danger: "border border-error/40 bg-bone text-error hover:bg-error/10 disabled:opacity-40",
  dangerSolid: "bg-error text-bone hover:bg-error/90 disabled:opacity-40",
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge";

type CommonProps = {
  variant?: Variant;
  icon?: Icon;
  children?: React.ReactNode;
  className?: string;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type AnchorProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & { href: string };

export default function AdminButton(props: ButtonProps | AnchorProps) {
  const { variant = "secondary", icon: IconCmp, children, className = "", ...rest } = props;
  const cls = `${BASE} ${VARIANT[variant]} ${className}`;
  const inner = (
    <>
      {IconCmp && <IconCmp size={18} weight="bold" />}
      {children}
    </>
  );
  if ("href" in props && props.href !== undefined) {
    return (
      <a className={cls} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}
