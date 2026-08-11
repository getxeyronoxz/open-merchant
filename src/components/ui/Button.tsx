import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variants: Record<ButtonVariant, string> = {
  primary: "border-emerald-300 bg-emerald-300 text-stone-950 hover:border-emerald-200 hover:bg-emerald-200 active:bg-emerald-400",
  secondary: "border-stone-700 bg-stone-900 text-stone-100 hover:border-stone-600 hover:bg-stone-800 active:bg-stone-950",
  ghost: "border-transparent bg-transparent text-stone-300 hover:bg-stone-800 hover:text-stone-50 active:bg-stone-900",
  danger: "border-rose-900/70 bg-rose-950/30 text-rose-200 hover:border-rose-800 hover:bg-rose-950/60 active:bg-rose-950",
};

export function Button({
  children,
  className,
  icon,
  size = "md",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: IconName;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={classNames(
        "inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border font-semibold outline-none transition-[background-color,border-color,color,transform,opacity] duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon ? <Icon className="size-4 shrink-0" name={icon} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: IconName;
}) {
  return (
    <button
      aria-label={label}
      className={classNames(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-stone-800 bg-stone-900 text-stone-400 outline-none transition-[background-color,border-color,color,transform] duration-[var(--motion-fast)] hover:border-stone-700 hover:bg-stone-800 hover:text-stone-100 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      title={label}
      type="button"
      {...props}
    >
      <Icon className="size-[18px]" name={icon} />
    </button>
  );
}
