import { describe, expect, it } from "vitest";

import type {
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  MarketSnapshot,
  RunRecord,
} from "@open-merchant/shared";

import { calculateScenarios } from "../src/economics";
import {
  deriveDispositions,
  standingReviews,
  type StandingReviewInput,
} from "../src/standing-reviews";

/**
 * Standing reviews are derived, never stored: this suite fixes the derivation
 * and, more importantly, the suppression rules. A snooze that does not
 * actually hide the review is worse than no snooze at all, because the seller
 * believes they have dealt with it.
 */

const NOW = new Date("2026-09-26T09:00:00.000Z");
const DAY = 86_400_000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

function assumptions(threshold: string | null): CostAssumptions {
  return {
    currency: "INR",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "0.00",
    paymentFeeRate: "0.00",
    otherCosts: "20.00",
    scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    marginThresholdPercent: threshold,
  };
}

function scenario(name: "low" | "base" | "high", margin: string): EconomicsScenario {
  return {
    scenario: name,
    sellingPrice: "1000.00",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "0.00",
    paymentFeeRate: "0.00",
    otherCosts: "20.00",
    marketplaceFee: "0.00",
    paymentFee: "0.00",
    totalCost: "595.50",
    grossProfit: "404.50",
    grossMarginPercent: margin,
  };
}

function run(overrides: Partial<RunRecord> & Pick<RunRecord, "operation">): RunRecord {
  return {
    runId: `RUN-${overrides.operation}`,
    startedAt: daysAgo(1),
    completedAt: daysAgo(1),
    status: "succeeded",
    appVersion: "1.0.0-alpha.4",
    inputArtifacts: [],
    outputArtifacts: [],
    errorSummary: null,
    ...overrides,
  };
}

function evidence(id: string, ageDays: number): EvidenceSource {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Source ${id}`,
    notes: "",
    observations: [],
    observedAt: daysAgo(ageDays),
    createdAt: daysAgo(ageDays),
    updatedAt: daysAgo(ageDays),
  };
}

function snapshot(id: string, capturedDaysAgo: number, median: string): MarketSnapshot {
  return {
    id: id as MarketSnapshot["id"],
    capturedAt: daysAgo(capturedDaysAgo),
    note: "",
    listingCount: 1,
    statistics: { validPriceCount: 1, minimum: median, maximum: median, average: median, median },
    listings: [],
  };
}

function project(overrides: Partial<StandingReviewInput> = {}): StandingReviewInput {
  return {
    root: "C:/projects/Keyboards",
    name: "Keyboards",
    runs: [],
    evidence: [],
    assumptions: null,
    scenarios: [],
    snapshots: [],
    ...overrides,
  };
}

describe("deriveDispositions", () => {
  const snooze = (key: string, until: string | null) =>
    run({
      operation: "reviewSnoozed",
      completedAt: "2026-09-20T09:00:00.000Z",
      review: {
        reviewKey: key,
        action: "snoozed",
        reviewDueAt: "2026-09-11T09:00:00.000Z",
        until,
        recordedAt: "2026-09-20T09:00:00.000Z",
      },
    });

  it("is empty for a project that has never been dispositioned", () => {
    expect(deriveDispositions([run({ operation: "reportGenerated" })])).toEqual([]);
  });

  it("reads back a snooze and a dismissal", () => {
    const runs = [
      snooze("stale-evidence:S-001", "2026-10-03T09:00:00.000Z"),
      run({
        operation: "reviewDismissed",
        completedAt: "2026-09-21T09:00:00.000Z",
        review: {
          reviewKey: "margin-watch:base",
          action: "dismissed",
          reviewDueAt: "2026-09-11T09:00:00.000Z",
          until: null,
          recordedAt: "2026-09-21T09:00:00.000Z",
        },
      }),
    ];

    const found = deriveDispositions(runs);

    expect(found.map((d) => d.reviewKey).sort()).toEqual(["margin-watch:base", "stale-evidence:S-001"]);
  });

  it("keeps only the newest disposition when a review is dispositioned twice", () => {
    const older = snooze("stale-evidence:S-001", "2026-10-03T09:00:00.000Z");
    const newer = run({
      operation: "reviewSnoozed",
      completedAt: "2026-09-25T09:00:00.000Z",
      review: {
        reviewKey: "stale-evidence:S-001",
        action: "snoozed",
        reviewDueAt: "2026-09-11T09:00:00.000Z",
        until: "2026-10-25T09:00:00.000Z",
        recordedAt: "2026-09-25T09:00:00.000Z",
      },
    });

    expect(deriveDispositions([older, newer])).toHaveLength(1);
    expect(deriveDispositions([older, newer])[0]?.until).toBe("2026-10-25T09:00:00.000Z");
  });

  it("ignores a failed review run", () => {
    const failed = { ...snooze("stale-evidence:S-001", null), status: "failed" as const };

    expect(deriveDispositions([failed])).toEqual([]);
  });
});

describe("standingReviews", () => {
  it("says nothing about a project with no signals at all", () => {
    expect(standingReviews([project()], NOW)).toEqual([]);
  });

  describe("stale evidence", () => {
    it("flags evidence older than the staleness window, and not fresher evidence", () => {
      const reviews = standingReviews(
        [project({ evidence: [evidence("S-001", 45), evidence("S-002", 5)] })],
        NOW,
      );

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.key).toBe("stale-evidence:S-001");
      expect(reviews[0]?.kind).toBe("stale-evidence");
      expect(reviews[0]?.severity).toBe("warning");
    });

    it("dates the review to when the evidence went stale, not to now", () => {
      const reviews = standingReviews([project({ evidence: [evidence("S-001", 45)] })], NOW);

      // 45 days observed minus the 30-day window.
      expect(reviews[0]?.dueAt).toBe(daysAgo(15));
    });

    it("names the project the review belongs to", () => {
      const reviews = standingReviews([project({ evidence: [evidence("S-001", 45)] })], NOW);

      expect(reviews[0]?.projectName).toBe("Keyboards");
      expect(reviews[0]?.projectRoot).toBe("C:/projects/Keyboards");
    });
  });

  describe("unchecked decision", () => {
    it("flags a project with economics and no report", () => {
      const reviews = standingReviews(
        [project({ assumptions: assumptions(null), scenarios: [scenario("base", "40.45")] })],
        NOW,
      );

      expect(reviews.map((r) => r.kind)).toEqual(["unchecked-decision"]);
    });

    it("stays quiet once a report has been generated", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions(null),
            scenarios: [scenario("base", "40.45")],
            runs: [run({ operation: "reportGenerated" })],
          }),
        ],
        NOW,
      );

      expect(reviews).toEqual([]);
    });

    it("ignores a report run that failed", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions(null),
            scenarios: [scenario("base", "40.45")],
            runs: [run({ operation: "reportGenerated", status: "failed" })],
          }),
        ],
        NOW,
      );

      expect(reviews.map((r) => r.kind)).toEqual(["unchecked-decision"]);
    });

    it("stays quiet for a project with no economics at all", () => {
      expect(standingReviews([project({ evidence: [evidence("S-001", 1)] })], NOW)).toEqual([]);
    });

    it("stays quiet for a project that has assumptions but has priced nothing", () => {
      // Every new project is seeded with default assumptions. Keying the
      // review off those would open the app by accusing the seller of an
      // unfinished decision they have not started.
      expect(standingReviews([project({ assumptions: assumptions(null) })], NOW)).toEqual([]);
    });

    it("is only a warning once the decision has been sitting for a week", () => {
      const fresh = standingReviews(
        [project({ assumptions: assumptions(null), scenarios: [scenario("base", "40.45")] })],
        NOW,
      );
      const old = standingReviews(
        [
          project({
            assumptions: assumptions(null),
            scenarios: [scenario("base", "40.45")],
            runs: [run({ operation: "economicsGenerated", completedAt: daysAgo(9) })],
          }),
        ],
        NOW,
      );

      expect(fresh[0]?.severity).toBe("info");
      expect(old[0]?.severity).toBe("warning");
    });

    it("dates the review to when the economics were first generated", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions(null),
            scenarios: [scenario("base", "40.45")],
            runs: [run({ operation: "economicsGenerated", completedAt: daysAgo(9) })],
          }),
        ],
        NOW,
      );

      expect(reviews[0]?.dueAt).toBe(daysAgo(9));
    });
  });

  describe("margin flags", () => {
    it("raises a critical review when a scenario breaches the threshold", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions("20.00"),
            scenarios: calculateScenarios(assumptions("20.00")),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "700.00")],
          }),
        ],
        NOW,
      );

      const breach = reviews.find((r) => r.kind === "margin-breach");
      expect(breach?.severity).toBe("critical");
      expect(breach?.key).toMatch(/^margin-breach:(low|base|high)$/u);
    });

    it("raises a warning when a scenario sits in the watch band", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions("20.00"),
            scenarios: calculateScenarios(assumptions("20.00")),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "749.00")],
          }),
        ],
        NOW,
      );

      expect(reviews.some((r) => r.kind === "margin-watch")).toBe(true);
      expect(reviews.every((r) => r.severity === "warning")).toBe(true);
    });

    it("says nothing when every scenario is comfortably healthy", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions("20.00"),
            scenarios: calculateScenarios(assumptions("20.00")),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "1500.00")],
          }),
        ],
        NOW,
      );

      expect(reviews).toEqual([]);
    });

    it("says nothing when no threshold has been set", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions(null),
            scenarios: calculateScenarios(assumptions(null)),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "700.00")],
          }),
        ],
        NOW,
      );

      expect(reviews).toEqual([]);
    });

    it("dates the review to the snapshot that revealed it", () => {
      const reviews = standingReviews(
        [
          project({
            assumptions: assumptions("20.00"),
            scenarios: calculateScenarios(assumptions("20.00")),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "700.00")],
          }),
        ],
        NOW,
      );

      expect(reviews[0]?.dueAt).toBe(daysAgo(6));
    });
  });

  describe("suppression", () => {
    const staleProject = (): StandingReviewInput =>
      project({ evidence: [evidence("S-001", 45)] });

    // Evidence observed 45 days ago went stale 15 days ago; that is the
    // occurrence any disposition below is recorded against.
    const STALE_DUE_AT = daysAgo(15);

    const snoozed = (until: string | null) =>
      run({
        operation: "reviewSnoozed",
        completedAt: "2026-09-20T09:00:00.000Z",
        review: {
          reviewKey: "stale-evidence:S-001",
          action: "snoozed",
          reviewDueAt: STALE_DUE_AT,
          until,
          recordedAt: "2026-09-20T09:00:00.000Z",
        },
      });

    it("hides a review that is snoozed into the future", () => {
      const reviews = standingReviews([staleProject()], NOW);
      expect(reviews).toHaveLength(1);

      const afterSnooze = standingReviews(
        [{ ...staleProject(), runs: [snoozed("2026-10-03T09:00:00.000Z")] }],
        NOW,
      );

      expect(afterSnooze).toEqual([]);
    });

    it("brings a review back once its snooze has expired", () => {
      const reviews = standingReviews(
        [{ ...staleProject(), runs: [snoozed("2026-09-20T09:00:00.000Z")] }],
        NOW,
      );

      expect(reviews.map((r) => r.key)).toEqual(["stale-evidence:S-001"]);
    });

    it("hides a dismissed review", () => {
      const dismissal = run({
        operation: "reviewDismissed",
        completedAt: "2026-09-20T09:00:00.000Z",
        review: {
          reviewKey: "stale-evidence:S-001",
          action: "dismissed",
          reviewDueAt: STALE_DUE_AT,
          until: null,
          recordedAt: "2026-09-20T09:00:00.000Z",
        },
      });

      expect(standingReviews([{ ...staleProject(), runs: [dismissal] }], NOW)).toEqual([]);
    });

    it("lets the same condition return once it has cleared and recurred", () => {
      // The seller dismisses the stale evidence, then re-observes it, which
      // clears the review. Years later that new observation goes stale of its
      // own accord. The dismissal was recorded against the old occurrence and
      // must not silence the new one.
      const dismissal = run({
        operation: "reviewDismissed",
        completedAt: "2026-09-20T09:00:00.000Z",
        review: {
          reviewKey: "stale-evidence:S-001",
          action: "dismissed",
          reviewDueAt: STALE_DUE_AT,
          until: null,
          recordedAt: "2026-09-20T09:00:00.000Z",
        },
      });

      // Refreshed ten days ago: no longer stale, so nothing to show.
      const refreshed = standingReviews(
        [{ ...staleProject(), runs: [dismissal], evidence: [evidence("S-001", 10)] }],
        NOW,
      );
      expect(refreshed).toEqual([]);

      // That refresh goes stale in turn — a new occurrence, new dueAt.
      const recurred = standingReviews(
        [{ ...staleProject(), runs: [dismissal], evidence: [evidence("S-001", 10)] }],
        new Date("2027-09-26T09:00:00.000Z"),
      );
      expect(recurred.map((r) => r.key)).toEqual(["stale-evidence:S-001"]);
    });

    it("suppresses only the named review", () => {
      const reviews = standingReviews(
        [
          {
            ...staleProject(),
            evidence: [evidence("S-001", 45), evidence("S-002", 60)],
            runs: [snoozed("2026-10-03T09:00:00.000Z")],
          },
        ],
        NOW,
      );

      expect(reviews.map((r) => r.key)).toEqual(["stale-evidence:S-002"]);
    });
  });

  describe("ordering", () => {
    it("puts the most severe and oldest first", () => {
      const reviews = standingReviews(
        [
          project({
            name: "Breaching",
            root: "C:/projects/Breaching",
            assumptions: assumptions("20.00"),
            scenarios: calculateScenarios(assumptions("20.00")),
            runs: [run({ operation: "reportGenerated" })],
            snapshots: [snapshot("SNAP-20260920T090000Z-abcd", 6, "700.00")],
            evidence: [evidence("S-001", 45)],
          }),
          project({
            name: "Quiet",
            root: "C:/projects/Quiet",
            evidence: [evidence("S-009", 90)],
          }),
        ],
        NOW,
      );

      expect(reviews[0]?.severity).toBe("critical");
      expect(reviews[0]?.projectName).toBe("Breaching");
      // Within the warnings, the older one leads: Quiet's evidence is 90 days
      // old against Breaching's 45.
      const warnings = reviews.filter((r) => r.severity === "warning");
      expect(warnings[0]?.projectName).toBe("Quiet");
      expect(warnings.map((r) => r.dueAt)).toEqual([...warnings.map((r) => r.dueAt)].sort());
    });

    it("spans every project given to it", () => {
      const reviews = standingReviews(
        [
          project({ name: "A", root: "C:/a", evidence: [evidence("S-001", 45)] }),
          project({ name: "B", root: "C:/b", evidence: [evidence("S-002", 45)] }),
        ],
        NOW,
      );

      expect(new Set(reviews.map((r) => r.projectName))).toEqual(new Set(["A", "B"]));
    });
  });
});
