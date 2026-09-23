import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ArtifactPaths } from "@open-merchant/core";

import { ReadOnlyProject, parseEvidenceText, parseRunsJournalText } from "../src/project.js";
import { cleanupFixture, createFixture, type Fixture } from "./fixture.js";

async function countMcpReads(root: string): Promise<number> {
  const raw = await readFile(join(root, ArtifactPaths.runs), "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { operation?: string })
    .filter((entry) => entry.operation === "mcpArtifactRead").length;
}

describe("ReadOnlyProject", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("opens a real project and exposes its manifest", async () => {
    const project = await ReadOnlyProject.open(fixture.root);
    expect(project.manifest.name).toBe("MCP Fixture");
    expect(project.manifest.currency).toBe("INR");
    expect(project.manifest.objective).toContain("MCP lane");
  });

  it("refuses folders that are not projects and folders that do not exist", async () => {
    const empty = await mkdtemp(join(tmpdir(), "om-mcp-not-a-project-"));
    await expect(ReadOnlyProject.open(empty)).rejects.toThrow("not an Open Merchant project");
    await expect(ReadOnlyProject.open(join(empty, "missing"))).rejects.toThrow("No project folder");
    await rm(empty, { recursive: true, force: true });
  });

  it("refuses a malformed manifest without touching it", async () => {
    const broken = await createFixture();
    await writeFile(join(broken.root, ArtifactPaths.manifest), "{ broken json", "utf8");
    await expect(ReadOnlyProject.open(broken.root)).rejects.toThrow("manifest is malformed");
    await cleanupFixture(broken);
  });

  it("reads raw artifacts through the known-layout guard", async () => {
    const project = await ReadOnlyProject.open(fixture.root);
    const text = await project.readRaw(ArtifactPaths.evidence);
    expect(parseEvidenceText(text)).toHaveLength(1);
    await expect(project.readRaw("reports/not-a-known-artifact.md")).rejects.toThrow(
      "Unknown artifact",
    );
  });

  it("journals every read as a fingerprinted mcpArtifactRead run", async () => {
    const project = await ReadOnlyProject.open(fixture.root);
    const before = await countMcpReads(fixture.root);
    const text = await project.readRaw(ArtifactPaths.evidence);
    await project.journalRead(ArtifactPaths.evidence, text);

    const raw = await readFile(join(fixture.root, ArtifactPaths.runs), "utf8");
    const runs = parseRunsJournalText(raw);
    expect(runs.filter((run) => run.operation === "mcpArtifactRead")).toHaveLength(before + 1);
    const last = runs[runs.length - 1];
    expect(last?.runId).toMatch(/^RUN-MCP-/u);
    expect(last?.status).toBe("succeeded");
    expect(last?.inputArtifacts[0]?.path).toBe(ArtifactPaths.evidence);
    expect(last?.inputArtifacts[0]?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(last?.outputArtifacts).toEqual([]);
  });

  it("lists snapshots and reads them through the id guard", async () => {
    const project = await ReadOnlyProject.open(fixture.root);
    expect(await project.listSnapshotIds()).toEqual([fixture.snapshotId]);
    const text = await project.loadSnapshotText(fixture.snapshotId);
    expect(text).not.toBeNull();
    expect(JSON.parse(text ?? "")).toHaveProperty("id", fixture.snapshotId);
    await expect(project.loadSnapshotText("../../escape")).rejects.toThrow("Unsafe snapshot id");
  });
});
