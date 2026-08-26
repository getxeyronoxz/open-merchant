import { readFile } from "node:fs/promises";

import {
  provenanceRecordSchema,
  runRecordSchema,
  type ProvenanceRecord,
  type RunRecord,
} from "@open-merchant/shared";

import { appendLineAtomically, writeFileAtomically } from "./atomic";

/**
 * Append-only journals for generation history. Every meaningful operation
 * becomes a run record; every generated artifact gains a provenance record
 * linking it to its run and content hash. Malformed journal lines reject —
 * they are never skipped or repaired.
 */

async function readJsonl<T>(path: string, parse: (value: unknown) => T): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parse(JSON.parse(line)));
}

export class RunJournal {
  constructor(private readonly runsPath: string, private readonly provenancePath: string) {}

  async appendRun(run: RunRecord): Promise<void> {
    await appendLineAtomically(this.runsPath, JSON.stringify(runRecordSchema.parse(run)));
  }

  /** Replaces a run in place (used to close out a failed-then-resolved run). */
  async replaceRun(replacement: RunRecord): Promise<void> {
    const runs = await this.listRuns();
    const index = runs.findIndex((run) => run.runId === replacement.runId);
    if (index === -1) throw new Error(`Run not found: ${replacement.runId}`);
    runs[index] = runRecordSchema.parse(replacement);
    const contents = `${runs.map((run) => JSON.stringify(run)).join("\n")}\n`;
    await writeFileAtomically(this.runsPath, contents);
  }

  async listRuns(): Promise<RunRecord[]> {
    return readJsonl(this.runsPath, (value) => runRecordSchema.parse(value));
  }

  async appendProvenance(record: ProvenanceRecord): Promise<void> {
    await appendLineAtomically(this.provenancePath, JSON.stringify(provenanceRecordSchema.parse(record)));
  }

  async listProvenance(): Promise<ProvenanceRecord[]> {
    return readJsonl(this.provenancePath, (value) => provenanceRecordSchema.parse(value));
  }
}
