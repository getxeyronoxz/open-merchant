import { describe, expect, it } from "vitest";

import { reviewDispositionSchema, reviewKeyShape, runRecordSchema } from "../src/provenance";

/**
 * A review key is a stable identifier for one nag inside one project:
 * `<kind>:<subject>`. It is persisted in the project's run journal, so its
 * shape is a real contract — it must be able to say what the four review kinds
 * actually are, while remaining incapable of expressing a filesystem path.
 */

const KINDS = ["unchecked-decision", "stale-evidence", "margin-watch", "margin-breach"] as const;

function key(kind: string, subject: string): string {
  return `${kind}:${subject}`;
}

describe("reviewKey", () => {
  it.each(KINDS)("admits the %s kind verbatim", (kind) => {
    expect(reviewKeyShape.safeParse(key(kind, "S-001")).success).toBe(true);
  });

  it("admits the subjects the core actually emits", () => {
    // Scenario names are the zod enum, evidence ids are S-001 style, and the
    // project-level unchecked decision has no subject of its own.
    for (const subject of ["low", "base", "high", "S-001", "S-1024", "decision", "a_b-C9"]) {
      expect(reviewKeyShape.safeParse(key("stale-evidence", subject)).success).toBe(true);
    }
  });

  it("refuses a key that could name a path", () => {
    for (const bad of [
      "stale-evidence:../../etc/passwd",
      "stale-evidence:a/b",
      "stale-evidence:a\\b",
      "stale-evidence:..",
    ]) {
      expect(reviewKeyShape.safeParse(bad).success).toBe(false);
    }
  });

  it("refuses a kind that is not lowercase-dashed, or is empty", () => {
    for (const bad of ["Stale-evidence:S-001", "stale evidence:S-001", ":S-001", "1st:S-001"]) {
      expect(reviewKeyShape.safeParse(bad).success).toBe(false);
    }
  });

  it("refuses more than three segments", () => {
    expect(reviewKeyShape.safeParse("stale-evidence:S-001:extra:more").success).toBe(false);
  });
});

describe("reviewDispositionSchema", () => {
  it("round-trips a snooze that expires", () => {
    const parsed = reviewDispositionSchema.parse({
      reviewKey: "margin-watch:base",
      action: "snoozed",
      reviewDueAt: "2026-09-19T09:00:00.000Z",
      until: "2026-10-03T09:00:00.000Z",
      recordedAt: "2026-09-26T09:00:00.000Z",
    });

    expect(parsed.until).toBe("2026-10-03T09:00:00.000Z");
    expect(parsed.action).toBe("snoozed");
    expect(parsed.reviewKey).toBe("margin-watch:base");
  });

  it("accepts a dismissal with no end date", () => {
    expect(
      reviewDispositionSchema.safeParse({
        reviewKey: "stale-evidence:S-001",
        action: "dismissed",
        reviewDueAt: "2026-09-19T09:00:00.000Z",
        until: null,
        recordedAt: "2026-09-26T09:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("requires the occurrence being silenced, not just the kind of review", () => {
    // Without reviewDueAt a dismissal is permanent: the seller silences stale
    // evidence, refreshes it, and it goes stale again next year still hidden.
    expect(
      reviewDispositionSchema.safeParse({
        reviewKey: "stale-evidence:S-001",
        action: "dismissed",
        until: null,
        recordedAt: "2026-09-26T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("refuses an action that is neither snoozed nor dismissed", () => {
    expect(
      reviewDispositionSchema.safeParse({
        reviewKey: "stale-evidence:S-001",
        action: "ignored",
        reviewDueAt: "2026-09-19T09:00:00.000Z",
        until: null,
        recordedAt: "2026-09-26T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

/**
 * A snooze has to be persisted somewhere, and the only append-only record a
 * project keeps is its run journal. The disposition therefore rides along as a
 * validated payload on the run — never smuggled into `inputArtifacts`, which
 * means "a real file was read" and would put a lie in the journal.
 */
describe("runRecordSchema review payload", () => {
  const base = {
    runId: "RUN-1",
    startedAt: "2026-09-26T09:00:00.000Z",
    completedAt: "2026-09-26T09:00:00.000Z",
    status: "succeeded",
    appVersion: "1.0.0-alpha.4",
    inputArtifacts: [],
    outputArtifacts: [],
    errorSummary: null,
  } as const;

  const snooze = {
    reviewKey: "stale-evidence:S-001",
    action: "snoozed",
    reviewDueAt: "2026-09-19T09:00:00.000Z",
    until: "2026-10-03T09:00:00.000Z",
    recordedAt: "2026-09-26T09:00:00.000Z",
  } as const;

  it("carries the disposition on a snooze run", () => {
    const parsed = runRecordSchema.parse({ ...base, operation: "reviewSnoozed", review: snooze });

    expect(parsed.review?.reviewKey).toBe("stale-evidence:S-001");
  });

  it("carries the disposition on a dismiss run", () => {
    const parsed = runRecordSchema.parse({
      ...base,
      operation: "reviewDismissed",
      review: { ...snooze, action: "dismissed", until: null },
    });

    expect(parsed.review?.action).toBe("dismissed");
  });

  it("refuses a review run with no disposition attached", () => {
    expect(runRecordSchema.safeParse({ ...base, operation: "reviewSnoozed" }).success).toBe(false);
  });

  it("refuses a disposition whose action contradicts the operation", () => {
    // A run that says "dismissed" while carrying a snooze would make the
    // journal disagree with itself.
    expect(
      runRecordSchema.safeParse({ ...base, operation: "reviewDismissed", review: snooze }).success,
    ).toBe(false);
  });

  it("refuses a disposition hung on an unrelated operation", () => {
    expect(
      runRecordSchema.safeParse({ ...base, operation: "reportGenerated", review: snooze }).success,
    ).toBe(false);
  });

  it("leaves every existing run record valid with no disposition", () => {
    expect(runRecordSchema.safeParse({ ...base, operation: "reportGenerated" }).success).toBe(true);
  });
});
