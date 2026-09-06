import { describe, expect, it } from "vitest";

import type { EvidenceSource, RunRecord } from "@open-merchant/shared";

import { STALE_AFTER_DAYS, decisionJournal } from "../src/decision-journal";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function run(operation: RunRecord["operation"], status: RunRecord["status"], completedAt: string): RunRecord {
  return {
    runId: `RUN-${completedAt}`,
    operation,
    startedAt: completedAt,
    completedAt,
    status,
    appVersion: "test",
    inputArtifacts: [],
    outputArtifacts: [],
    errorSummary: null,
  };
}

function evidence(id: string, observedAt: string): EvidenceSource {
  return {
    id,
    url: "https://example.com/listing",
    title: `Source ${id}`,
    notes: "",
    observations: [],
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

describe("decision journal", () => {
  it("lists only successful report generations, oldest first", () => {
    const journal = decisionJournal(
      [
        run("reportGenerated", "failed", "2026-09-01T10:00:00.000Z"),
        run("economicsGenerated", "succeeded", "2026-09-02T10:00:00.000Z"),
        run("reportGenerated", "succeeded", "2026-09-03T10:00:00.000Z"),
        run("reportGenerated", "succeeded", "2026-08-20T10:00:00.000Z"),
      ],
      [],
      NOW,
    );
    expect(journal.entries.map((entry) => entry.completedAt)).toEqual([
      "2026-08-20T10:00:00.000Z",
      "2026-09-03T10:00:00.000Z",
    ]);
    expect(journal.entries.every((entry) => entry.status === "succeeded")).toBe(true);
  });

  it("flags evidence older than the staleness window with age in days", () => {
    const journal = decisionJournal(
      [],
      [
        evidence("S-001", "2026-08-01T00:00:00.000Z"), // 35 days → stale
        evidence("S-002", "2026-08-06T12:00:00.000Z"), // exactly 30 days → not stale
        evidence("S-003", "2026-09-01T00:00:00.000Z"), // 4 days → not stale
      ],
      NOW,
    );
    expect(journal.staleAfterDays).toBe(STALE_AFTER_DAYS);
    expect(journal.staleEvidence.map((entry) => entry.id)).toEqual(["S-001"]);
    expect(journal.staleEvidence[0]?.ageDays).toBe(35);
  });

  it("returns an empty journal for a fresh project", () => {
    const journal = decisionJournal([], [], NOW);
    expect(journal.entries).toEqual([]);
    expect(journal.staleEvidence).toEqual([]);
  });
});