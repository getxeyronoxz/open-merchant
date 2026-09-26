import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { StandingReview } from "@open-merchant/shared";

import { StandingReviewsCard } from "./StandingReviewsCard";

/**
 * The attention card. What matters here is that a nag is legible and that its
 * two exits are actually offered: a seller who cannot see what is wrong, or
 * cannot do anything about it, will simply stop reading the card.
 */

function review(overrides: Partial<StandingReview> = {}): StandingReview {
  return {
    key: "stale-evidence:S-001",
    kind: "stale-evidence",
    title: "Evidence is 45 days old",
    detail: "Market listing page was observed 45 days ago and has not been re-checked.",
    dueAt: "2026-09-11T09:00:00.000Z",
    severity: "warning",
    projectRoot: "C:/projects/Keyboards",
    projectName: "Keyboards",
    ...overrides,
  };
}

function render(props: Partial<Parameters<typeof StandingReviewsCard>[0]> = {}): string {
  return renderToStaticMarkup(
    <StandingReviewsCard
      reviews={[review()]}
      isPending={false}
      isError={false}
      error={null}
      onRetry={() => undefined}
      onDispose={() => undefined}
      pendingKey={null}
      {...props}
    />,
  );
}

describe("StandingReviewsCard", () => {
  it("names what needs attention and which project it belongs to", () => {
    const html = render();

    expect(html).toContain("Needs attention");
    expect(html).toContain("Evidence is 45 days old");
    expect(html).toContain("Keyboards");
  });

  it("shows how long ago the review became due, in plain words", () => {
    expect(render()).toContain("days ago");
  });

  it("offers both exits: snooze and dismiss", () => {
    const html = render();

    expect(html).toContain("Snooze a week");
    expect(html).toContain("Dismiss");
  });

  it("says what snoozing and dismissing actually do", () => {
    expect(render()).toContain("recorded");
  });

  it("shows the severity of each review", () => {
    const html = render({ reviews: [review({ severity: "critical" })] });

    expect(html).toContain("critical");
  });

  it("renders nothing at all when there is nothing to attend to", () => {
    // An empty attention card is noise; the portfolio below it already says
    // "no decisions yet" on a fresh install.
    expect(render({ reviews: [] })).toBe("");
  });

  it("renders nothing while the queue is still loading", () => {
    expect(render({ isPending: true })).toBe("");
  });

  it("surfaces a failure with a way to retry, rather than hiding it", () => {
    const html = render({ isError: true, error: new Error("boom") });

    expect(html).toContain("Needs attention");
    expect(html.length).toBeGreaterThan(0);
  });

  it("marks the buttons busy while that review is being dispositioned", () => {
    const html = render({ pendingKey: "stale-evidence:S-001" });

    expect(html).toContain("Working…");
    expect(html).toContain("disabled");
  });

  it("keeps its buttons out of any surrounding form", () => {
    // The card sits beside the create-workspace form on the Home screen; a
    // stray submit-type button would reload the page instead of snoozing.
    const html = render();
    const buttons = html.match(/<button[^>]*>/gu) ?? [];

    expect(buttons).toHaveLength(2);
    expect(buttons.every((tag) => tag.includes('type="button"'))).toBe(true);
  });
});
