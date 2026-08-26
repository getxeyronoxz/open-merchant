import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "primary" | "secondary" | "ghost" | "danger";
  readonly children: ReactNode;
}

const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "om-button om-button--primary",
  secondary: "om-button om-button--secondary",
  ghost: "om-button om-button--ghost",
  danger: "om-button om-button--danger",
};

/**
 * Base button primitive. Visual styling ships with the design system
 * stylesheet; this component owns semantics and variant selection only.
 */
export function Button({ variant = "secondary", children, className = "", ...rest }: ButtonProps) {
  return (
    <button className={`${styles[variant]} ${className}`.trim()} type="button" {...rest}>
      {children}
    </button>
  );
}
