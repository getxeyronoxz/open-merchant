import type { HTMLAttributes, ReactNode } from "react";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={classNames(
        "rounded-[var(--radius-xl)] border border-stone-800/90 bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-panel)] sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function InsetPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        "rounded-[var(--radius-lg)] border border-stone-800 bg-[var(--surface-inset)] p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  action,
  description,
  eyebrow,
  status,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow: string;
  status?: ReactNode;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-stone-50 sm:text-[1.75rem]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-stone-400 sm:text-base">{description}</p> : null}
      </div>
      {action || status ? <div className="flex min-h-10 shrink-0 items-center gap-3">{status}{action}</div> : null}
    </header>
  );
}
