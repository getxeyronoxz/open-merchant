import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ProvenanceRecord, RunRecord } from "@open-merchant/shared";

import { statisticsFromSortedPrices } from "../src/statistics";
import { Decimal } from "../src/money";
import { RunJournal } from "../src/provenance";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function freshJournal(): Promise<{ dir: string; journal: RunJournal }> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-provenance-"));
  tempDirs.push(dir);
  return { dir, journal: new RunJournal(join(dir, "runs.jsonl"), join(dir, "provenance.jsonl")) };
}

const DIGEST = "a".repeat(64);
const AT = "2026-09-14T09:00:00.000Z";

function runRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: "run-001",
    operation: "reportGenerated",
    startedAt: AT,
    completedAt: AT,
    status: "succeeded",
    appVersion: "1.0.0-alpha.4",
    inputArtifacts: [],
    outputArtifacts: [{ path: "reports/opportunity-report.md", sha256: DIGEST }],
    errorSummary: null,
    ...overrides,
  };
}

function provenanceRecord(overrides: Partial<ProvenanceRecord> = {}): ProvenanceRecord {
  return {
    runId: "run-001",
    artifactPath: "reports/opportunity-report.md",
    sha256: DIGEST,
    generatedAt: AT,
    origin: { kind: "user" },
    ...overrides,
  };
}

describe("statistics - direct boundaries", () => {
  it("reports a null-filled empty state for zero prices and for all-unpriced listings", () => {
    expect(statisticsFromSortedPrices([])).toEqual({
      validPriceCount: 0,
      minimum: null,
      maximum: null,
      average: null,
      median: null,
    });
  });

  it("returns single-point statistics where every measure equals the only price", () => {
    expect(statisticsFromSortedPrices([new Decimal("749.00")])).toEqual({
      validPriceCount: 1,
      minimum: "749.00",
      maximum: "749.00",
      average: "749.00",
      median: "749.00",
    });
  });

  it("picks exact extremes from already-sorted input without resorting", () => {
    const stats = statisticsFromSortedPrices([
      new Decimal("10.00"),
      new Decimal("10.01"),
      new Decimal("99.99"),
    ]);
    expect(stats.minimum).toBe("10.00");
    expect(stats.maximum).toBe("99.99");
  });
});

describe("provenance - journals", () => {
  it("round-trips runs and provenance records through the journals", async () => {
    const { journal } = await freshJournal();
    await journal.appendRun(runRecord());
    await journal.appendProvenance(provenanceRecord());

    expect(await journal.listRuns()).toEqual([runRecord()]);
    expect(await journal.listProvenance()).toEqual([provenanceRecord()]);
  });

  it("returns empty lists before any journal file exists", async () => {
    const { journal } = await freshJournal();
    expect(await journal.listRuns()).toEqual([]);
    expect(await journal.listProvenance()).toEqual([]);
  });

  it("replaces a run in place to close out a failed-then-resolved run", async () => {
    const { journal } = await freshJournal();
    await journal.appendRun(runRecord({ runId: "run-9", status: "failed", errorSummary: "boom" }));
    await journal.replaceRun(runRecord({ runId: "run-9" }));

    const runs = await journal.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ runId: "run-9", status: "succeeded", errorSummary: null });
  });

  it("refuses to replace a run id that was never recorded", async () => {
    const { journal } = await freshJournal();
    await expect(journal.replaceRun(runRecord({ runId: "ghost" }))).rejects.toThrow(/Run not found/u);
  });

  it("rejects malformed journal lines instead of skipping them", async () => {
    const { dir, journal } = await freshJournal();
    await writeFile(join(dir, "runs.jsonl"), `${JSON.stringify(runRecord())}\nnot json\n`);
    await expect(journal.listRuns()).rejects.toThrow();
  });

  it("validates provenance records before they reach the journal", async () => {
    const { journal } = await freshJournal();
    await expect(
      journal.appendProvenance(provenanceRecord({ sha256: "not-a-digest" })),
    ).rejects.toThrow();
    expect(await journal.listProvenance()).toEqual([]);
  });

  it("records AI origins so drafts audit back to agent, provider, and model", async () => {
    const { journal } = await freshJournal();
    const origin = {
      kind: "agent",
      agentId: "evidence-synthesizer",
      providerId: "anthropic",
      modelId: "claude-sonnet-5",
      promptHash: DIGEST,
    } as const;
    await journal.appendProvenance(provenanceRecord({ origin }));

    const records = await journal.listProvenance();
    expect(records[0]?.origin).toEqual(origin);
  });

  it("appends provenance lines atomically without disturbing the runs journal", async () => {
    const { dir, journal } = await freshJournal();
    await journal.appendRun(runRecord());
    await journal.appendProvenance(provenanceRecord());
    await journal.appendProvenance(provenanceRecord({ artifactPath: "economics/scenarios.json" }));

    const runsRaw = await readFile(join(dir, "runs.jsonl"), "utf8");
    const provenanceRaw = await readFile(join(dir, "provenance.jsonl"), "utf8");
    expect(runsRaw.trim().split("\n")).toHaveLength(1);
    expect(provenanceRaw.trim().split("\n")).toHaveLength(2);
  });
});
