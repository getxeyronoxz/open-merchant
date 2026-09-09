import { deflateRawSync, inflateRawSync } from "node:zlib";

import { ArtifactPaths, MARKET_SNAPSHOTS_DIR } from "./layout";

/**
 * File-first pillar (phase 2): portable single-file project archives
 * (`.omarchive`). A self-describing, versioned envelope of deflated files —
 * no external archive tooling, restorable on any platform. Paths are guarded
 * exactly like the known workspace layout.
 */

const ARCHIVE_FORMAT = "open-merchant-archive";
const ARCHIVE_VERSION = 1;

export interface ArchiveFile {
  readonly path: string;
  readonly content: string;
}

interface ArchiveEnvelope {
  readonly format: string;
  readonly version: number;
  readonly createdAt: string;
  readonly files: readonly { readonly path: string; readonly data: string }[];
}

const KNOWN_PATHS: readonly string[] = Object.values(ArtifactPaths);
const SNAPSHOT_FILE_PATTERN = /^SNAP-\d{8}T\d{6}Z-[0-9a-f]{4}\.json$/u;

function isArchivablePath(path: string): boolean {
  if (KNOWN_PATHS.includes(path)) return true;
  if (!path.startsWith(`${MARKET_SNAPSHOTS_DIR}/`)) return false;
  return SNAPSHOT_FILE_PATTERN.test(path.slice(MARKET_SNAPSHOTS_DIR.length + 1));
}

/** Deflates every file into a single self-describing `.omarchive` envelope. */
export function createArchive(files: readonly ArchiveFile[]): Buffer {
  for (const file of files) {
    if (!isArchivablePath(file.path)) {
      throw new Error(`Refusing to archive unknown path: ${file.path}`);
    }
  }
  const envelope: ArchiveEnvelope = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    createdAt: new Date().toISOString(),
    files: [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({
        path: file.path,
        data: deflateRawSync(Buffer.from(file.content, "utf8")).toString("base64"),
      })),
  };
  return Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

/** Parses and inflates an archive; rejects wrong formats, versions, and unsafe paths. */
export function readArchive(bytes: Buffer): ArchiveFile[] {
  let envelope: ArchiveEnvelope;
  try {
    envelope = JSON.parse(bytes.toString("utf8")) as ArchiveEnvelope;
  } catch (error) {
    throw new Error(
      `Not an Open Merchant archive (malformed JSON): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (envelope.format !== ARCHIVE_FORMAT) {
    throw new Error("Not an Open Merchant archive");
  }
  if (envelope.version !== ARCHIVE_VERSION) {
    throw new Error(`Unsupported archive version: ${String(envelope.version)}`);
  }
  if (!Array.isArray(envelope.files)) {
    throw new Error("Archive contains no file list");
  }
  return envelope.files.map((file) => {
    if (typeof file.path !== "string" || !isArchivablePath(file.path)) {
      throw new Error(`Archive contains an unknown or unsafe path: ${String(file.path)}`);
    }
    return { path: file.path, content: inflateRawSync(Buffer.from(file.data, "base64")).toString("utf8") };
  });
}