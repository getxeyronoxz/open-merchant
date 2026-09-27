import { randomUUID } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  ArtifactPaths,
  MARKET_SNAPSHOTS_DIR,
  RunJournal,
  WorkspaceError,
  fingerprintContents,
  isSnapshotFileName,
  readArtifactIfPresent,
  resolveKnownDirectory,
  resolveKnownArtifact,
  resolveSnapshotFile,
  validateAssumptions,
  validateCompetitors,
  validateEvidenceSources,
  WORKSPACE_DIR,
} from "@open-merchant/core";
import {
  competitorSchema,
  costAssumptionsSchema,
  economicsScenarioSchema,
  evidenceSourceSchema,
  manifestSchema,
  provenanceRecordSchema,
  reportSectionsSchema,
  runRecordSchema,
  type Competitor,
  type CostAssumptions,
  type EconomicsScenario,
  type EvidenceSource,
  type Manifest,
  type ProvenanceRecord,
  type ReportSections,
  type RunRecord,
} from "@open-merchant/shared";

import { MCP_SERVER_VERSION } from "./version.js";

/**
 * The read-only half of the draft gate, protocol edition.
 *
 * This module deliberately imports **no artifact-writing API** from
 * `@open-merchant/core` — no `writeFileAtomically`, no `save*`, no store. The
 * single write it can perform is `journalRead`, which appends an audit line to
 * the project's `runs.jsonl` run journal for every resource an MCP host reads.
 * The pure `parse*` helpers reject malformed content loudly; they never repair.
 */

// --- pure parsers (one read, validated against workspace format v2) -----------

export function parseManifestText(text: string): Manifest {
  return manifestSchema.parse(JSON.parse(text));
}

export function parseEvidenceText(text: string): EvidenceSource[] {
  const sources = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => evidenceSourceSchema.parse(JSON.parse(line)));
  validateEvidenceSources(sources);
  return sources;
}

export function parseCompetitorsText(text: string, currency: string): Competitor[] {
  const competitors = competitorSchema.array().parse(JSON.parse(text || "[]"));
  validateCompetitors(competitors, currency);
  return competitors;
}

export function parseAssumptionsText(text: string, currency: string): CostAssumptions {
  const assumptions = costAssumptionsSchema.parse(JSON.parse(text));
  validateAssumptions(assumptions, currency);
  return assumptions;
}

export function parseScenariosText(text: string): EconomicsScenario[] {
  return economicsScenarioSchema.array().parse(JSON.parse(text || "[]"));
}

export function parseReportSectionsText(text: string): ReportSections {
  return reportSectionsSchema.parse(JSON.parse(text || "{}"));
}

/** Splits JSONL, rejecting every malformed line — journals are never repaired. */
function parseJsonl<T>(text: string, parse: (value: unknown) => T): T[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parse(JSON.parse(line)));
}

export function parseRunsJournalText(text: string): RunRecord[] {
  return parseJsonl(text, (value) => runRecordSchema.parse(value));
}

export function parseProvenanceJournalText(text: string): ProvenanceRecord[] {
  return parseJsonl(text, (value) => provenanceRecordSchema.parse(value));
}

// --- the reader ---------------------------------------------------------------

export class ReadOnlyProject {
  private constructor(
    readonly root: string,
    readonly manifest: Manifest,
    private readonly journal: RunJournal,
  ) {}

  /** Opens an existing project folder; malformed manifests are refused. */
  static async open(root: string): Promise<ReadOnlyProject> {
    let stats;
    try {
      stats = await stat(root);
    } catch {
      throw new WorkspaceError(`No project folder at ${root}`);
    }
    if (!stats.isDirectory()) throw new WorkspaceError(`No project folder at ${root}`);

    const raw = await readArtifactIfPresent(await resolveKnownArtifact(root, ArtifactPaths.manifest));
    if (raw === null) {
      throw new WorkspaceError("That folder is not an Open Merchant project.");
    }
    let manifest: Manifest;
    try {
      manifest = parseManifestText(raw);
    } catch (error) {
      throw new WorkspaceError(
        `This project's manifest is malformed and was left unchanged: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return new ReadOnlyProject(
      root,
      manifest,
      new RunJournal(join(root, ArtifactPaths.runs), join(root, ArtifactPaths.provenance)),
    );
  }

  /** Guard-enforced raw read of a known artifact; null when absent. */
  async readRawOrNull(relativePath: string): Promise<string | null> {
    return readArtifactIfPresent(await resolveKnownArtifact(this.root, relativePath));
  }

  /** Guard-enforced raw read; absence is an error for artifacts that must exist. */
  async readRaw(relativePath: string): Promise<string> {
    const text = await this.readRawOrNull(relativePath);
    if (text === null) throw new WorkspaceError(`Artifact does not exist yet: ${relativePath}`);
    return text;
  }

  /** Snapshot ids on disk, sorted; a missing directory reads as empty. */
  async listSnapshotIds(): Promise<string[]> {
    try {
      const directory = await resolveKnownDirectory(this.root, MARKET_SNAPSHOTS_DIR);
      const names = await readdir(directory);
      return names
        .filter(isSnapshotFileName)
        .map((name) => name.slice(0, -".json".length))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /** Raw text of one snapshot, resolved through the traversal/symlink guards. */
  async loadSnapshotText(snapshotId: string): Promise<string | null> {
    return readArtifactIfPresent(await resolveSnapshotFile(this.root, snapshotId));
  }

  /**
   * The audit trail: every successful resource read appends one
   * `mcpArtifactRead` run record fingerprinted with the exact bytes served.
   */
  async journalRead(relativePath: string, contents: string): Promise<void> {
    await resolveKnownDirectory(this.root, WORKSPACE_DIR);
    await resolveKnownArtifact(this.root, ArtifactPaths.runs);
    const now = new Date().toISOString();
    await this.journal.appendRun({
      runId: `RUN-MCP-${randomUUID()}`,
      operation: "mcpArtifactRead",
      startedAt: now,
      completedAt: now,
      status: "succeeded",
      appVersion: MCP_SERVER_VERSION,
      inputArtifacts: [fingerprintContents(relativePath, contents)],
      outputArtifacts: [],
      errorSummary: null,
    });
  }
}
