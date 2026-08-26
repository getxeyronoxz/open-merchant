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
