import type { ReactNode } from "react";

import { Icon } from "./Icon";

export type StatusTone = "neutral" | "working" | "success" | "error";

export function StatusMessage({ children, className = "", label, tone = "neutral" }: { children?: ReactNode; className?: string; label?: string; tone?: StatusTone }) {
  if (!children) return <span aria-label={label} aria-live="polite" className="sr-only" role="status" />;

  const toneClass = tone === "success" ? "text-emerald-300" : tone === "error" ? "text-rose-300" : "text-stone-400";
  const icon = tone === "success" ? "check" : tone === "error" ? "warning" : null;

  return (
    <span
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${toneClass} ${className}`}
      role="status"
    >
      {icon ? <Icon className="size-4" name={icon} /> : null}
      {children}
    </span>
  );
}
