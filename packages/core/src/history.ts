import { join } from "node:path";

import { readArtifactIfPresent, WORKSPACE_DIR } from "./layout";
import { writeFileAtomically } from "./atomic";

/**
 * Generated-content history: immutable snapshots of every scenario and
 * report generation, keyed by the run that produced them. Files live under
 * `.openmerchant/history/` with file names built here from a fixed kind plus
 * a validated run id — callers never supply a free-form path, so the
 * known-layout guard's "no arbitrary filesystem access" property is
 * preserved exactly as it is for run/provenance journals.
 */

export const HISTORY_DIR = `${WORKSPACE_DIR}/history`;

export const historyKinds = ["scenarios", "report"] as const;
export type HistoryKind = (typeof historyKinds)[number];

/** Run ids are `RUN-<uuid>`; anything outside a safe word set is rejected. */
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/u;

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryError";
  }
}

export function historyFileName(kind: HistoryKind, runId: string): string {
  if (!historyKinds.includes(kind)) {
    throw new HistoryError(`Unknown history kind: ${String(kind)}`);
  }
  if (!RUN_ID_PATTERN.test(runId) || runId.includes("..")) {
    throw new HistoryError(`Unsafe history run id: ${runId}`);
  }
  return `${kind}-${runId}.${kind === "report" ? "md" : "json"}`;
}

export class HistoryStore {
  constructor(private readonly historyDir: string) {}

  /** Writes an immutable snapshot; the parent directory is created on demand. */
  async snapshot(kind: HistoryKind, runId: string, contents: string): Promise<void> {
    await writeFileAtomically(join(this.historyDir, historyFileName(kind, runId)), contents);
  }

  /** Reads a snapshot; returns null when that generation was never captured. */
  async readSnapshot(kind: HistoryKind, runId: string): Promise<string | null> {
    return readArtifactIfPresent(join(this.historyDir, historyFileName(kind, runId)));
  }
}