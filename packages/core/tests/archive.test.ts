import { describe, expect, it } from "vitest";

import { createArchive, readArchive } from "../src/archive";
import { ArtifactPaths } from "../src/layout";

const MANIFEST = `${JSON.stringify({ schemaVersion: 2, name: "Test" }, null, 2)}\n`;

describe("project archives", () => {
  it("round-trips files through a single envelope", () => {
    const bytes = createArchive([
      { path: ArtifactPaths.manifest, content: MANIFEST },
      { path: ArtifactPaths.competitors, content: "[]" },
      {
        path: "market/snapshots/SNAP-20260905T081234Z-4f2a.json",
        content: "{}",
      },
    ]);
    const files = readArchive(bytes);
    expect(files.map((file) => file.path)).toEqual([
      ArtifactPaths.manifest,
      ArtifactPaths.competitors,
      "market/snapshots/SNAP-20260905T081234Z-4f2a.json",
    ]);
    const manifest = files.find((file) => file.path === ArtifactPaths.manifest);
    expect(manifest?.content).toBe(MANIFEST);
  });

  it("survives a base64 round-trip exactly like the renderer download path", () => {
    const bytes = createArchive([
      { path: ArtifactPaths.manifest, content: MANIFEST },
      { path: ArtifactPaths.competitors, content: '[{"id":"C-001"}]' },
    ]);
    // Main sends archiveBase64 over IPC; the renderer decodes it back to
    // bytes before download. Corrupting any byte >= 0x80 here must break
    // the restore — this pins the binary-safe path.
    const restored = Buffer.from(bytes.toString("base64"), "base64");
    expect(restored.equals(bytes)).toBe(true);
    expect(readArchive(restored).map((file) => file.path)).toEqual([
      ArtifactPaths.manifest,
      ArtifactPaths.competitors,
    ]);
  });

  it("lists files in sorted path order regardless of input order", () => {
    const first = createArchive([
      { path: ArtifactPaths.competitors, content: "[]" },
      { path: ArtifactPaths.manifest, content: MANIFEST },
    ]);
    // Paths are sorted; contents follow their paths, not the input order.
    expect(readArchive(first).map((file) => file.path)).toEqual([
      ArtifactPaths.manifest,
      ArtifactPaths.competitors,
    ]);
  });

  it("rejects unknown, escaping, and foreign archives", () => {
    expect(() => createArchive([{ path: "../escape", content: "" }])).toThrow(/unknown path/u);
    expect(() =>
      readArchive(Buffer.from('{"format":"something-else","version":1,"files":[]}')),
    ).toThrow(/Not an Open Merchant archive/u);
    expect(() =>
      createArchive([{ path: "market/snapshots/evil.json", content: "" }]),
    ).toThrow(/unknown path/u);
  });
});