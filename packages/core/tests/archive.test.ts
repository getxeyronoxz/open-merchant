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