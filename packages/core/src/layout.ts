import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, sep } from "node:path";

/**
 * Known workspace layout (format v2). The app only ever reads and writes
 * these project-relative paths — arbitrary filesystem access is impossible
 * by construction, mirroring the legacy engine's artifact guard.
 */

export const WORKSPACE_DIR = ".openmerchant";

export const ArtifactPaths = {
  manifest: `${WORKSPACE_DIR}/manifest.json`,
  runs: `${WORKSPACE_DIR}/runs.jsonl`,
  provenance: `${WORKSPACE_DIR}/provenance.jsonl`,
  evidence: "evidence/sources.jsonl",
  competitors: "market/competitors.json",
  assumptions: "economics/assumptions.json",
  scenarios: "economics/scenarios.json",
  reportSections: "reports/report-sections.json",
  opportunityReport: "reports/opportunity-report.md",
} as const;

/** Directory holding immutable market snapshots (phase 2). */
export const MARKET_SNAPSHOTS_DIR = "market/snapshots";
const SNAPSHOT_ID_PATTERN = /^SNAP-\d{8}T\d{6}Z-[0-9a-f]{4}$/u;
const SNAPSHOT_FILE_PATTERN = /^SNAP-\d{8}T\d{6}Z-[0-9a-f]{4}\.json$/u;

/**
 * Resolves a market snapshot file inside the known snapshots directory with
 * the same traversal, symlink, and escape guards as known artifacts. Snapshot
 * ids are strictly shaped, so an id can never smuggle a path.
 */
export async function resolveSnapshotFile(workspaceRoot: string, snapshotId: string): Promise<string> {
  if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) {
    throw new ArtifactPathError(`Unsafe snapshot id: ${snapshotId}`);
  }
  const absolute = join(workspaceRoot, MARKET_SNAPSHOTS_DIR, `${snapshotId}.json`);
  try {
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) {
      throw new ArtifactPathError(`Snapshot is a symbolic link: ${snapshotId}`);
    }
    const real = await realpath(absolute);
    const realRoot = await realpath(workspaceRoot);
    if (!real.startsWith(realRoot + sep) && real !== realRoot) {
      throw new ArtifactPathError(`Snapshot escapes the workspace: ${snapshotId}`);
    }
  } catch (error) {
    if (error instanceof ArtifactPathError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ArtifactPathError(`Cannot access snapshot ${snapshotId}: ${String(error)}`);
    }
  }
  return absolute;
}

export function isSnapshotFileName(name: string): boolean {
  return SNAPSHOT_FILE_PATTERN.test(name);
}

export type KnownArtifact = keyof typeof ArtifactPaths;

export const KNOWN_ARTIFACT_PATHS: readonly string[] = Object.values(ArtifactPaths);

export function isKnownArtifactPath(relativePath: string): boolean {
  return (KNOWN_ARTIFACT_PATHS as readonly string[]).includes(relativePath);
}

export class ArtifactPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactPathError";
  }
}

/**
 * Resolves a known project-relative artifact to an absolute path,
 * refusing traversal, absolute inputs, unknown paths, and anything that
 * escapes the workspace through symlinks.
 */
export async function resolveKnownArtifact(workspaceRoot: string, relativePath: string): Promise<string> {
  // Hostile shapes get the clearest rejection first.
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
    throw new ArtifactPathError(`Unsafe artifact path: ${relativePath}`);
  }
  if (!isKnownArtifactPath(relativePath)) {
    throw new ArtifactPathError(`Unknown artifact: ${relativePath}`);
  }

  const absolute = join(workspaceRoot, ...relativePath.split("/"));
  try {
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) {
      throw new ArtifactPathError(`Artifact is a symbolic link: ${relativePath}`);
    }
    const real = await realpath(absolute);
    const realRoot = await realpath(workspaceRoot);
    if (!real.startsWith(realRoot + sep) && real !== realRoot) {
      throw new ArtifactPathError(`Artifact escapes the workspace: ${relativePath}`);
    }
  } catch (error) {
    if (error instanceof ArtifactPathError) throw error;
    // Missing file is acceptable — callers treat it as an empty/default value.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ArtifactPathError(`Cannot access artifact ${relativePath}: ${String(error)}`);
    }
  }
  return absolute;
}

/** Reads an artifact if present; returns null when absent. */
export async function readArtifactIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
