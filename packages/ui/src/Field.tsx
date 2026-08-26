import type { ReactNode } from "react";

export interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Label + control + optional hint. The label wraps its control, so the
 * association is implicit — no id plumbing needed by callers. */
export function Field({ label, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`om-field ${className}`.trim()}>
      <span className="om-field__label">{label}</span>
      {children}
      {hint ? <span className="om-field__hint">{hint}</span> : null}
    </label>
  );
}
