import { MARKET_SNAPSHOTS_DIR } from "@open-merchant/core";
import { marketSnapshotSchema } from "@open-merchant/shared";

import {
  type ReadOnlyProject,
  parseAssumptionsText,
  parseCompetitorsText,
  parseEvidenceText,
  parseManifestText,
  parseProvenanceJournalText,
  parseReportSectionsText,
  parseRunsJournalText,
  parseScenariosText,
} from "./project.js";

/** Every artifact resource the server exposes, in listing order. */
export interface ArtifactResource {
  readonly uri: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly mimeType: string;
  /** Project-relative path in the known workspace layout. */
  readonly relativePath: string;
}

export const SNAPSHOT_URI_PREFIX = "openmerchant://snapshots/";
/** RFC 6570 template covering `openmerchant://snapshots/{id}`. */
export const SNAPSHOT_TEMPLATE = "openmerchant://snapshots/{id}";

export const ARTIFACT_RESOURCES: readonly ArtifactResource[] = [
  {
    uri: "openmerchant://manifest",
    name: "manifest",
    title: "Research objective",
    description: "Project identity: name, objective, currency, timestamps.",
    mimeType: "application/json",
    relativePath: ".openmerchant/manifest.json",
  },
  {
    uri: "openmerchant://evidence",
    name: "evidence",
    title: "Evidence library",
    description: "User-owned evidence sources with their observations (JSONL).",
    mimeType: "application/x-ndjson",
    relativePath: "evidence/sources.jsonl",
  },
  {
    uri: "openmerchant://competitors",
    name: "competitors",
    title: "Market landscape",
    description: "Tracked competitor listings and prices.",
    mimeType: "application/json",
    relativePath: "market/competitors.json",
  },
  {
    uri: "openmerchant://snapshots",
    name: "snapshots",
    title: "Market snapshot index",
    description: "Ids of every immutable market snapshot on disk.",
    mimeType: "application/json",
    relativePath: MARKET_SNAPSHOTS_DIR,
  },
  {
    uri: "openmerchant://economics/assumptions",
    name: "economics-assumptions",
    title: "Cost assumptions",
    description: "Unit-economics assumptions and scenario price inputs.",
    mimeType: "application/json",
    relativePath: "economics/assumptions.json",
  },
  {
    uri: "openmerchant://economics/scenarios",
    name: "economics-scenarios",
    title: "Economics scenarios",
    description: "Calculated low/base/high scenarios with exact decimal outputs.",
    mimeType: "application/json",
    relativePath: "economics/scenarios.json",
  },
  {
    uri: "openmerchant://reports/sections",
    name: "report-sections",
    title: "Report sections",
    description: "Structured opportunity-report sections before rendering.",
    mimeType: "application/json",
    relativePath: "reports/report-sections.json",
  },
  {
    uri: "openmerchant://reports/opportunity",
    name: "opportunity-report",
    title: "Opportunity report",
    description: "The generated opportunity report (Markdown).",
    mimeType: "text/markdown",
    relativePath: "reports/opportunity-report.md",
  },
  {
    uri: "openmerchant://journal/runs",
    name: "runs-journal",
    title: "Run journal",
    description: "Append-only journal of meaningful operations (JSONL).",
    mimeType: "application/x-ndjson",
    relativePath: ".openmerchant/runs.jsonl",
  },
  {
    uri: "openmerchant://journal/provenance",
    name: "provenance-journal",
    title: "Provenance journal",
    description: "Artifacts linked to runs, hashes, and AI origin (JSONL).",
    mimeType: "application/x-ndjson",
    relativePath: ".openmerchant/provenance.jsonl",
  },
] as const;

export interface ReadResult {
  readonly mimeType: string;
  readonly text: string;
}

/** The requested resource does not exist — distinct from a malformed one. */
export class UnknownResourceError extends Error {
  constructor(uri: string) {
    super(`No such resource: ${uri}`);
    this.name = "UnknownResourceError";
  }
}

/** The artifact exists in the layout but has not been produced yet. */
export class ResourceNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotAvailableError";
  }
}

/** Validates the exact bytes about to be served — malformed means loud refusal. */
function validateArtifact(uri: string, text: string, project: ReadOnlyProject): void {
  switch (uri) {
    case "openmerchant://manifest":
      parseManifestText(text);
      return;
    case "openmerchant://evidence":
      parseEvidenceText(text);
      return;
    case "openmerchant://competitors":
      parseCompetitorsText(text, project.manifest.currency);
      return;
    case "openmerchant://economics/assumptions":
      parseAssumptionsText(text, project.manifest.currency);
      return;
    case "openmerchant://economics/scenarios":
      parseScenariosText(text);
      return;
    case "openmerchant://reports/sections":
      parseReportSectionsText(text);
      return;
    case "openmerchant://journal/runs":
      parseRunsJournalText(text);
      return;
    case "openmerchant://journal/provenance":
      parseProvenanceJournalText(text);
      return;
    default:
      // Raw markdown and the snapshot index need no schema of their own.
      return;
  }
}

/**
 * Reads, validates, journals, and returns one resource. One filesystem read per
 * call: the exact bytes validated are the exact bytes served, and each
 * successful call appends one `mcpArtifactRead` run record.
 */
export async function readResource(project: ReadOnlyProject, uri: string): Promise<ReadResult> {
  const entry = ARTIFACT_RESOURCES.find((resource) => resource.uri === uri);

  if (entry) {
    if (uri === "openmerchant://snapshots") {
      const ids = await project.listSnapshotIds();
      const text = JSON.stringify(ids, null, 2);
      await project.journalRead(entry.relativePath, text);
      return { mimeType: entry.mimeType, text };
    }

    const text =
      uri === "openmerchant://journal/provenance"
        ? ((await project.readRawOrNull(entry.relativePath)) ?? "")
        : await project.readRaw(entry.relativePath);

    validateArtifact(uri, text, project);
    await project.journalRead(entry.relativePath, text);
    return { mimeType: entry.mimeType, text };
  }

  if (uri.startsWith(SNAPSHOT_URI_PREFIX)) {
    const id = uri.slice(SNAPSHOT_URI_PREFIX.length);
    const text = await project.loadSnapshotText(id);
    if (text === null) throw new ResourceNotAvailableError(`No such snapshot: ${id}`);
    marketSnapshotSchema.parse(JSON.parse(text));
    await project.journalRead(`${MARKET_SNAPSHOTS_DIR}/${id}.json`, text);
    return { mimeType: "application/json", text };
  }

  throw new UnknownResourceError(uri);
}

/** Listing entries for the snapshot template (used by `resources/list`). */
export async function listSnapshotResources(
  project: ReadOnlyProject,
): Promise<{ uri: string; name: string; title: string; mimeType: string }[]> {
  const ids = await project.listSnapshotIds();
  return ids.map((id) => ({
    uri: `${SNAPSHOT_URI_PREFIX}${id}`,
    name: id,
    title: `Market snapshot ${id}`,
    mimeType: "application/json",
  }));
}
