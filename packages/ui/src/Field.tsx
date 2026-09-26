import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

export interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** What `Field` may need to wire onto the control it wraps. */
interface Describable {
  readonly id?: string;
  readonly "aria-describedby"?: string;
}

/**
 * Label + control + optional hint.
 *
 * The hint sits *outside* the label and is attached with `aria-describedby`.
 * That is the whole point of this component: when the hint lived inside the
 * `<label>`, the label's implicit association pulled the hint into the
 * control's accessible name, so a screen reader announced a paragraph of
 * guidance instead of the question the field asks. The association is still
 * automatic for callers — the control's id is generated here, so no call site
 * has to invent and thread one.
 */
export function Field({ label, hint, children, className = "" }: FieldProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;

  // A caller-supplied id is theirs to own; generating one anyway would break
  // whatever else already points at it. Every Field in the app passes a single
  // element, so this is the one shape to support.
  const existing = isValidElement(children) ? (children.props as Describable) : {};
  const controlId = existing.id ?? generatedId;
  const describedBy =
    hint === undefined
      ? existing["aria-describedby"]
      : [existing["aria-describedby"], hintId].filter(Boolean).join(" ");

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Describable>, {
        id: controlId,
        ...(describedBy === undefined ? {} : { "aria-describedby": describedBy }),
      })
    : children;

  return (
    <div className={`om-field ${className}`.trim()}>
      <label className="om-field__label" htmlFor={controlId}>
        {label}
      </label>
      {control}
      {hint ? (
        <span className="om-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
