import type { ReactNode } from "react";
import { AppError, appErrorSchema, type SerializedAppError } from "@open-merchant/shared";

/** Normalizes any thrown value into the shared serialized error shape. */
export function errorFrom(reason: unknown): SerializedAppError {
  if (reason instanceof AppError) return reason.toJSON();
  if (
    typeof reason === "object" &&
    reason !== null &&
    appErrorSchema.safeParse(reason).success
  ) {
    return appErrorSchema.parse(reason);
  }
  return {
    code: "storage-error",
    message: reason instanceof Error ? reason.message : String(reason),
  };
}

export interface ErrorStateProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly children?: ReactNode;
}

/**
 * The one way failures are shown: what went wrong, the coded cause, and a
 * way forward. Failures are never swallowed in Open Merchant.
 */
export function ErrorState({ error, onRetry, children }: ErrorStateProps) {
  const detail = errorFrom(error);
  return (
    <div className="om-error-state" role="alert">
      <strong>{detail.message}</strong>
      <span className="om-error-state__code">code: {detail.code}</span>
      {onRetry ? (
        <button className="om-button om-button--secondary" onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
      {children}
    </div>
  );
}
