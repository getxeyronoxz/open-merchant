import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ArtifactPaths } from "@open-merchant/core";

import { ReadOnlyProject } from "../src/project.js";
import {
  ARTIFACT_RESOURCES,
  UnknownResourceError,
  readResource,
} from "../src/resources.js";
import { cleanupFixture, createFixture, type Fixture } from "./fixture.js";

async function countMcpReads(root: string): Promise<number> {
  const raw = await readFile(join(root, ArtifactPaths.runs), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { operation?: string })
    .filter((entry) => entry.operation === "mcpArtifactRead").length;
}

describe("readResource", () => {
  let fixture: Fixture;
  let project: ReadOnlyProject;

  beforeAll(async () => {
    fixture = await createFixture();
    project = await ReadOnlyProject.open(fixture.root);
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("exposes the documented artifact table", () => {
    const uris = ARTIFACT_RESOURCES.map((resource) => resource.uri);
    expect(uris).toEqual([
      "openmerchant://manifest",
      "openmerchant://evidence",
      "openmerchant://competitors",
      "openmerchant://snapshots",
      "openmerchant://economics/assumptions",
      "openmerchant://economics/scenarios",
      "openmerchant://reports/sections",
      "openmerchant://reports/opportunity",
      "openmerchant://journal/runs",
      "openmerchant://journal/provenance",
    ]);
    expect(new Set(ARTIFACT_RESOURCES.map((resource) => resource.name)).size).toBe(uris.length);
  });

  it("serves the manifest, journals the read, and returns bytes as stored", async () => {
    const before = await countMcpReads(fixture.root);
    const result = await readResource(project, "openmerchant://manifest");
    expect(result.mimeType).toBe("application/json");
    expect(result.text).toContain("Does the MCP lane read the record?");
    expect(await countMcpReads(fixture.root)).toBe(before + 1);
  });

  it("validates evidence, competitors, economics, and journals each read", async () => {
    for (const uri of [
      "openmerchant://evidence",
      "openmerchant://competitors",
      "openmerchant://economics/assumptions",
      "openmerchant://economics/scenarios",
      "openmerchant://reports/sections",
      "openmerchant://reports/opportunity",
      "openmerchant://journal/runs",
    ]) {
      const result = await readResource(project, uri);
      expect(result.text.length).toBeGreaterThan(0);
    }
    expect(await countMcpReads(fixture.root)).toBeGreaterThanOrEqual(8);
  });

  it("lists snapshot ids and serves an individual snapshot", async () => {
    const index = await readResource(project, "openmerchant://snapshots");
    expect(JSON.parse(index.text)).toEqual([fixture.snapshotId]);
    const one = await readResource(project, `openmerchant://snapshots/${fixture.snapshotId}`);
    expect(JSON.parse(one.text)).toHaveProperty("id", fixture.snapshotId);
    await expect(readResource(project, "openmerchant://snapshots/SNAP-20000101T000000Z-beef")).rejects.toThrow(
      "No such snapshot",
    );
  });

  it("returns an empty provenance journal on a project that generated nothing", async () => {
    const result = await readResource(project, "openmerchant://journal/provenance");
    expect(result.text).toBe("");
  });

  it("reports a missing opportunity report loudly", async () => {
    const bare = await createFixture({ report: false });
    const bareProject = await ReadOnlyProject.open(bare.root);
    await expect(readResource(bareProject, "openmerchant://reports/opportunity")).rejects.toThrow(
      "does not exist yet",
    );
    await cleanupFixture(bare);
  });

  it("refuses unknown resources by name", async () => {
    await expect(readResource(project, "openmerchant://wallet")).rejects.toBeInstanceOf(
      UnknownResourceError,
    );
    await expect(readResource(project, "openmerchant://wallet")).rejects.toThrow(
      "No such resource",
    );
  });

  it("rejects malformed artifacts loudly instead of serving them", async () => {
    const broken = await createFixture();
    const brokenProject = await ReadOnlyProject.open(broken.root);
    await writeFile(join(broken.root, ArtifactPaths.evidence), "not json\n", "utf8");
    await expect(readResource(brokenProject, "openmerchant://evidence")).rejects.toThrow();
    await writeFile(join(broken.root, ArtifactPaths.runs), "{ not a run\n", "utf8");
    await expect(readResource(brokenProject, "openmerchant://journal/runs")).rejects.toThrow();
    // Failed reads never reach the journal: nothing was appended to the corrupt file.
    const raw = await readFile(join(broken.root, ArtifactPaths.runs), "utf8");
    expect(raw).toBe("{ not a run\n");
    expect(raw).not.toContain("mcpArtifactRead");
    await cleanupFixture(broken);
  });
});
