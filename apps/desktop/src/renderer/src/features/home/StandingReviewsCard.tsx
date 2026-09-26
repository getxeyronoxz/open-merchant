import type { StandingReview } from "@open-merchant/shared";

import { ErrorState } from "@open-merchant/ui";

/**
 * Phase 3 — standing reviews, on the Home screen above the portfolio.
 *
 * The portfolio answers "which project is worst?". This answers "what needs
 * attention this week?", across every project at once, with the two moves a
 * seller actually wants available on a nag: put it off for a week, or say it
 * is not a problem. Both are journaled in the project's run log, so neither is
 * a silent dismissal.
 *
 * The queue is derived in the main process from artifacts on disk. Nothing
 * here polls, schedules, or contacts anything.
 */

const SEVERITY_CLASS: Record<StandingReview["severity"], string> = {
  critical: "om-badge om-badge--danger",
  warning: "om-badge om-badge--brass",
  info: "om-badge",
};

function dueLabel(dueAt: string, now: number): string {
  const days = Math.floor((now - Date.parse(dueAt)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function StandingReviewsCard({
  reviews,
  isPending,
  isError,
  error,
  onRetry,
  onDispose,
  pendingKey,
}: {
  readonly reviews: readonly StandingReview[];
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly onDispose: (review: StandingReview, action: "snoozed" | "dismissed") => void;
  readonly pendingKey: string | null;
}) {
  if (isError) {
    return (
      <section className="om-card" aria-label="Needs attention">
        <p className="om-eyebrow">Needs attention</p>
        <ErrorState error={error} onRetry={onRetry} />
      </section>
    );
  }
  if (isPending || reviews.length === 0) return null;

  const now = Date.now();

  return (
    <section className="om-card" aria-label="Needs attention">
      <p className="om-eyebrow">Needs attention</p>
      <p className="om-field__hint">
        {reviews.length} item{reviews.length === 1 ? "" : "s"} across your projects, oldest first.
        Snoozing holds a reminder for a week; dismissing says it is not a problem. Both are recorded.
      </p>
      <ul className="om-list">
        {reviews.map((review) => {
          const busy = pendingKey === review.key;
          return (
            <li key={`${review.projectRoot}:${review.key}`} className="om-list__row">
              <div className="om-list__copy">
                <p className="om-list__title">
                  <span className={SEVERITY_CLASS[review.severity]}>{review.severity}</span>
                  <span>{review.title}</span>
                </p>
                <p className="om-field__hint">
                  {review.projectName} · noticed {dueLabel(review.dueAt, now)} · {review.detail}
                </p>
              </div>
              <div className="om-list__actions">
                <button
                  className="om-button om-button--ghost"
                  disabled={busy}
                  onClick={() => onDispose(review, "snoozed")}
                  type="button"
                >
                  {busy ? "Working…" : "Snooze a week"}
                </button>
                <button
                  className="om-button om-button--ghost"
                  disabled={busy}
                  onClick={() => onDispose(review, "dismissed")}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
