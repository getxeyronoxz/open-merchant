import type { DecisionJournal, EvidenceSource, RunRecord } from "@open-merchant/shared";

/**
 * Decision journal (phase 2): the dated sequence of successful report
 * generations, plus evidence that has gone stale relative to now. Answers
 * "would I still make this decision today?" without opening raw journals.
 * Deterministic for a given `now` — no hidden clocks.
 */

/** Evidence older than this many days is flagged stale in the journal. */
export const STALE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function decisionJournal(
  runs: RunRecord[],
  evidence: EvidenceSource[],
  now: Date,
): DecisionJournal {
  const entries = runs
    .filter((run) => run.operation === "reportGenerated" && run.status === "succeeded")
    .map((run) => ({ runId: run.runId, completedAt: run.completedAt, status: "succeeded" as const }))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const staleAfterMs = STALE_AFTER_DAYS * DAY_MS;
  const staleEvidence = evidence
    .map((source) => ({
      id: source.id,
      title: source.title,
      observedAt: source.observedAt,
      ageDays: Math.max(0, Math.floor((now.getTime() - Date.parse(source.observedAt)) / DAY_MS)),
    }))
    .filter((entry) => now.getTime() - Date.parse(entry.observedAt) > staleAfterMs)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  return { entries, staleEvidence, staleAfterDays: STALE_AFTER_DAYS };
}