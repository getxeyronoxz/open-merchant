import type { ReactNode } from "react";

export interface EmptyStateProps {
  readonly title: string;
  readonly children?: ReactNode;
}

/** An empty screen is an invitation to act — say what to do next. */
export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="om-empty">
      <span className="om-empty__title">{title}</span>
      {children}
    </div>
  );
}
