import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { RunRecord } from "@open-merchant/shared";

import { appendLineAtomically, writeFileAtomically } from "../src/atomic";
import { fingerprintContents } from "../src/fingerprint";
import { RunJournal } from "../src/provenance";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-persist-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("writeFileAtomically", () => {
  it("replaces contents through a temporary file", async () => {
    const dir = await tempDir();
    const target = join(dir, "artifact.json");
    await writeFile(target, "old", "utf8");

    await writeFileAtomically(target, "new");
    expect(await readFile(target, "utf8")).toBe("new");

    // No temporary files are left behind.
    const leftovers = (await import("node:fs/promises")).readdir(dir);
    expect((await leftovers).filter((name) => name.includes(".tmp"))).toEqual([]);
  });

  it("creates missing parent directories", async () => {
    const dir = await tempDir();
    const target = join(dir, "nested", "deeper", "file.txt");
    await writeFileAtomically(target, "hello");
    expect(await readFile(target, "utf8")).toBe("hello");
  });
});

describe("appendLineAtomically", () => {
  it("appends to an existing journal without truncation", async () => {
    const dir = await tempDir();
    const journal = join(dir, "runs.jsonl");
    await appendLineAtomically(journal, '{"first":true}');
    await appendLineAtomically(journal, '{"second":true}');
    const raw = await readFile(journal, "utf8");
    expect(raw).toBe('{"first":true}\n{"second":true}\n');
  });

  it("starts a fresh journal when the file does not exist yet", async () => {
    const dir = await tempDir();
    const journal = join(dir, "absent.jsonl");
    await appendLineAtomically(journal, '{"a":1}');
    expect(await readFile(journal, "utf8")).toBe('{"a":1}\n');
  });
});

function makeRun(runId: string): RunRecord {
  return {
    runId,
    operation: "reportGenerated",
    startedAt: "2026-08-26T09:00:00.000Z",
    completedAt: "2026-08-26T09:01:00.000Z",
    status: "succeeded",
    appVersion: "1.0.0-alpha.0",
    inputArtifacts: [],
    outputArtifacts: [fingerprintContents("reports/opportunity-report.md", "# report")],
    errorSummary: null,
  };
}

describe("RunJournal", () => {
  it("records runs and provenance, and replaces runs by id", async () => {
    const dir = await tempDir();
    const journal = new RunJournal(join(dir, "runs.jsonl"), join(dir, "provenance.jsonl"));

    await journal.appendRun(makeRun("RUN-1"));
    await journal.appendRun({ ...makeRun("RUN-2"), status: "failed" });

    await journal.replaceRun({ ...makeRun("RUN-2"), status: "succeeded" });

    const runs = await journal.listRuns();
    expect(runs.map((run) => [run.runId, run.status])).toEqual([
      ["RUN-1", "succeeded"],
      ["RUN-2", "succeeded"],
    ]);

    await journal.appendProvenance({
      runId: "RUN-1",
      artifactPath: "reports/opportunity-report.md",
      sha256: fingerprintContents("x", "x").sha256,
      generatedAt: "2026-08-26T09:01:00.000Z",
      origin: { kind: "user" },
    });
    expect(await journal.listProvenance()).toHaveLength(1);
  });

  it("rejects replacing an unknown run", async () => {
    const dir = await tempDir();
    const journal = new RunJournal(join(dir, "runs.jsonl"), join(dir, "provenance.jsonl"));
    await expect(journal.replaceRun(makeRun("RUN-missing"))).rejects.toThrow(/not found/iu);
  });
});
