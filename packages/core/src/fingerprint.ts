import { createHash } from "node:crypto";

import { artifactFingerprintSchema, type ArtifactFingerprint } from "@open-merchant/shared";

/** Content fingerprints recorded in runs and provenance journals. */
export function fingerprintContents(relativePath: string, contents: string | Uint8Array): ArtifactFingerprint {
  return artifactFingerprintSchema.parse({
    path: relativePath,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}
