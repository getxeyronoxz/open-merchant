import {
  reviewDispositionsSchema,
  type CostAssumptions,
  type EconomicsScenario,
  type EvidenceSource,
  type MarketSnapshot,
  type ReviewDisposition,
  type RunRecord,
  type StandingReview,
} from "@open-merchant/shared";

import { STALE_AFTER_DAYS } from "./decision-journal";
import { marginMonitor } from "./monitor";

/**
 * Standing reviews (phase 3): the local timers that answer "what needs
 * attention this week?".
 *
 * Every signal here is already computed elsewhere — the core has flagged stale
 * evidence in the decision journal and drifting margins in the margin monitor —
 * but both only speak inside a single project the seller has to open. This
 * module derives the same facts across every project at once.
 *
 * Two properties are deliberate and are what the rest of the design rests on:
 *
 *  - **Derived, never stored.** There is no reviews artifact, so the queue can
 *    never drift out of step with the evidence it describes.
 *  - **`now` is a parameter.** `decisionJournal` sets the same precedent. A
 *    queue whose contents depend on an invisible clock is not testable.
 *
 * Dispositions are read back out of the run journal rather than kept in their
 * own file, which is why a dismissal expires by itself: when the condition that
 * produced the review stops being generated, the review it silenced is gone, and
 * the disposition goes with it. The same condition recurring later is new
 * information, and is surfaced.
 */

/** How long a snooze lasts. The roadmap asks about "this week", so this is a week. */
export const SNOOZE_DAYS = 7;

/** An unchecked decision becomes worth a warning after this long. */
export const UNCHECKED_WARNING_AFTER_DAYS = 7;

const DAY_MS = 86_400_000;

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

/** Everything the derivation needs about one project, already read from disk. */
export interface StandingReviewInput {
  readonly root: string;
  readonly name: string;
  readonly runs: readonly RunRecord[];
  readonly evidence: readonly EvidenceSource[];
  readonly assumptions: CostAssumptions | null;
  readonly scenarios: readonly EconomicsScenario[];
  readonly snapshots: readonly MarketSnapshot[];
}

function isReviewRun(run: RunRecord): boolean {
  return run.operation === "reviewSnoozed" || run.operation === "reviewDismissed";
}

/**
 * Reads the dispositions a project has recorded, newest per review key.
 *
 * `runRecordSchema` already guarantees a review run carries a disposition
 * whose action matches its operation, so this only has to select and
 * de-duplicate. The result is still validated as a collection: a journal is
 * project data, and malformed data is rejected rather than repaired.
 */
export function deriveDispositions(runs: readonly RunRecord[]): ReviewDisposition[] {
  const newest = new Map<string, ReviewDisposition>();
  for (const run of runs) {
    if (run.status !== "succeeded" || !isReviewRun(run) || run.review === undefined) continue;
    const existing = newest.get(run.review.reviewKey);
    if (existing === undefined || run.review.recordedAt > existing.recordedAt) {
      newest.set(run.review.reviewKey, run.review);
    }
  }
  return reviewDispositionsSchema.parse({
    dispositions: [...newest.values()].sort((a, b) => a.reviewKey.localeCompare(b.reviewKey)),
  }).dispositions;
}

/** A disposition that still suppresses: a live snooze, or a dismissal. */
function isLive(disposition: ReviewDisposition, now: Date): boolean {
  if (disposition.action === "dismissed") return true;
  return disposition.until !== null && Date.parse(disposition.until) > now.getTime();
}

/**
 * A disposition silences one occurrence of a review, not the condition forever.
 * Matching on the occurrence's `dueAt` is what makes a dismissal expire: when
 * the evidence is refreshed and goes stale again, the new occurrence carries a
 * new `dueAt`, the old disposition no longer applies, and the seller sees it.
 */
function isSuppressed(
  review: Pick<StandingReview, "key" | "dueAt">,
  dispositions: ReadonlyMap<string, ReviewDisposition>,
  now: Date,
): boolean {
  const disposition = dispositions.get(review.key);
  if (disposition === undefined) return false;
  if (disposition.reviewDueAt !== review.dueAt) return false;
  return isLive(disposition, now);
}

function ageInDays(from: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY_MS));
}

function shiftDays(from: string, days: number): string {
  return new Date(Date.parse(from) + days * DAY_MS).toISOString();
}

function earliestRun(runs: readonly RunRecord[], operation: RunRecord["operation"]): string | null {
  let earliest: string | null = null;
  for (const run of runs) {
    if (run.operation !== operation || run.status !== "succeeded") continue;
    if (earliest === null || run.completedAt < earliest) earliest = run.completedAt;
  }
  return earliest;
}

function reviewsForProject(
  input: StandingReviewInput,
  now: Date,
  dispositions: ReadonlyMap<string, ReviewDisposition>,
): StandingReview[] {
  const found: StandingReview[] = [];
  const push = (review: StandingReview): void => {
    if (!isSuppressed(review, dispositions, now)) found.push(review);
  };

  // 1. Stale evidence — the core already calls this stale in the journal.
  for (const source of input.evidence) {
    if (ageInDays(source.observedAt, now) <= STALE_AFTER_DAYS) continue;
    const age = ageInDays(source.observedAt, now);
    push({
      key: `stale-evidence:${source.id}`,
      kind: "stale-evidence",
      title: `Evidence is ${age} days old`,
      detail: `${source.title} was observed ${age} days ago and has not been re-checked.`,
      dueAt: shiftDays(source.observedAt, STALE_AFTER_DAYS),
      severity: "warning",
      projectRoot: input.root,
      projectName: input.name,
    });
  }

  // 2. Margin drift — the same flags the Economics screen shows, aged.
  const latest = input.snapshots[0] ?? null;
  if (input.assumptions !== null) {
    const monitor = marginMonitor(
      input.assumptions,
      input.scenarios,
      latest?.statistics.median ?? null,
      latest?.id ?? null,
    );
    for (const flag of monitor.flags) {
      if (flag.status !== "watch" && flag.status !== "breached") continue;
      const kind = flag.status === "breached" ? "margin-breach" : "margin-watch";
      const threshold = monitor.thresholdPercent;
      push({
        key: `${kind}:${flag.scenario}`,
        kind,
        title:
          flag.status === "breached"
            ? `${flag.scenario} margin has breached the threshold`
            : `${flag.scenario} margin is close to the threshold`,
        detail:
          `At the last snapshot this scenario earns ${flag.marginAtMarketPrice === null ? "—" : `${flag.marginAtMarketPrice}%`}` +
          ` (${flag.driftPercent === null ? "no drift recorded" : `${flag.driftPercent} points from plan`})` +
          `${threshold === null ? "" : `, against a ${threshold}% floor`}.`,
        dueAt: latest?.capturedAt ?? now.toISOString(),
        severity: flag.status === "breached" ? "critical" : "warning",
        projectRoot: input.root,
        projectName: input.name,
      });
    }
  }

  // 3. A decision assembled and never made. This is the one signal nothing
  //    else in the app raises, and the most expensive kind of unfinished work.
  //
  //    Scenarios are the trigger, not assumptions: every new project is seeded
  //    with default assumptions, so keying off those would open the app by
  //    accusing the seller of an unfinished decision they have not started.
  //    A scenario is the priced thing a decision is made *about*.
  const hasEconomics = input.scenarios.length > 0;
  const hasReport = input.runs.some(
    (run) => run.operation === "reportGenerated" && run.status === "succeeded",
  );
  if (hasEconomics && !hasReport) {
    const firstEconomics = earliestRun(input.runs, "economicsGenerated") ?? now.toISOString();
    const waiting = ageInDays(firstEconomics, now);
    push({
      key: "unchecked-decision:decision",
      kind: "unchecked-decision",
      title: "Economics are ready but no decision was recorded",
      detail: `${input.scenarios.length} scenario${input.scenarios.length === 1 ? "" : "s"} priced${waiting === 0 ? "" : ` ${waiting} days ago`} and no report has been generated since.`,
      dueAt: firstEconomics,
      severity: waiting >= UNCHECKED_WARNING_AFTER_DAYS ? "warning" : "info",
      projectRoot: input.root,
      projectName: input.name,
    });
  }

  return found;
}

/**
 * The attention queue across every project, worst and oldest first.
 *
 * @param now injected so the queue is deterministic for a given instant.
 */
export function standingReviews(
  projects: readonly StandingReviewInput[],
  now: Date,
): StandingReview[] {
  const reviews = projects.flatMap((project) => {
    const dispositions = new Map(
      deriveDispositions(project.runs).map((disposition) => [disposition.reviewKey, disposition]),
    );
    return reviewsForProject(project, now, dispositions);
  });

  return reviews.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.dueAt.localeCompare(b.dueAt) ||
      a.projectName.localeCompare(b.projectName) ||
      a.key.localeCompare(b.key),
  );
}
