import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

export function EmptyState({ action, description, icon, title }: { action?: ReactNode; description: string; icon: IconName; title: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-stone-800 bg-stone-950/30 px-5 py-8 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full border border-stone-800 bg-stone-900 text-stone-400">
        <Icon className="size-5" name={icon} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-stone-100">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-stone-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
