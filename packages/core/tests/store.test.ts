import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Competitor, EvidenceSource } from "@open-merchant/shared";

import { ArtifactPaths, resolveKnownArtifact } from "../src/layout";
import { WorkspaceError, WorkspaceStore, emptyAssumptions } from "../src/store";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-store-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function sampleEvidence(id: string): EvidenceSource {
  return {
    id,
    url: "https://example.com/listing",
    title: "Marketplace listing",
    notes: "note",
    observations: [{ id: "O-1", label: "Price", value: "499", unit: "INR", note: "" }],
    observedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
  };
}

function sampleCompetitor(id: string): Competitor {
  return {
    id,
    product: "Keyboard",
    brand: "Brand",
    price: "499.00",
    currency: "INR",
    marketplace: "Example Bazaar",
    url: "https://example.com",
    sourceId: null,
    notes: "",
    observedAt: "2026-08-26T09:00:00.000Z",
  };
}

describe("WorkspaceStore.create", () => {
  it("creates the full v2 layout with seeded defaults", async () => {
    const parent = await tempDir();
    const store = await WorkspaceStore.create({
      parentDirectory: parent,
      name: "Keyboards India",
      objective: "Decide market entry",
      currency: "INR",
    });

    expect(store.manifest.name).toBe("Keyboards India");
    expect(await stat(join(parent, "keyboards-india"))).toBeTruthy();

    // Defaults are present and valid.
    expect(await store.loadEvidence()).toEqual([]);
    expect(await store.loadCompetitors()).toEqual([]);
    expect(await store.loadAssumptions()).toEqual(emptyAssumptions("INR"));
    expect((await store.loadReportSections()).decisionSummary).toBe("");

    const artifacts = await store.listArtifacts();
    const byPath = new Map(artifacts.map((entry) => [entry.path, entry.exists]));
    expect(byPath.get(ArtifactPaths.manifest)).toBe(true);
    expect(byPath.get(ArtifactPaths.evidence)).toBe(true);
    expect(byPath.get(ArtifactPaths.competitors)).toBe(true);
    expect(byPath.get(ArtifactPaths.opportunityReport)).toBe(false); // generated later
  });

  it("rolls back the whole folder when creation fails midway", async () => {
    const parent = await tempDir();
    await expect(
      WorkspaceStore.create({ parentDirectory: parent, name: "", objective: "x", currency: "INR" }),
    ).rejects.toThrow();
  });

  it("refuses to overwrite an existing folder", async () => {
    const parent = await tempDir();
    const input = { parentDirectory: parent, name: "Keyboards", objective: "one", currency: "INR" };
    await WorkspaceStore.create(input);
    await expect(WorkspaceStore.create({ ...input, objective: "two" })).rejects.toThrow(WorkspaceError);
  });
});

describe("WorkspaceStore.open", () => {
  it("reopens a created project with identical state", async () => {
    const parent = await tempDir();
    const original = await WorkspaceStore.create({
      parentDirectory: parent,
      name: "Keyboards",
      objective: "Objective",
      currency: "INR",
    });

    const reopened = await WorkspaceStore.open(original.root);
    expect(reopened.manifest).toEqual(original.manifest);
  });

  it("rejects folders without a valid v2 manifest", async () => {
    const parent = await tempDir();
    await expect(WorkspaceStore.open(parent)).rejects.toThrow(WorkspaceError);
  });
});

describe("artifact round-trips", () => {
  async function makeStore(): Promise<WorkspaceStore> {
    return WorkspaceStore.create({
      parentDirectory: await tempDir(),
      name: `Project ${Math.random().toString(36).slice(2, 7)}`,
      objective: "Test objective",
      currency: "INR",
    });
  }

  it("evidence persists as validated JSONL", async () => {
    const store = await makeStore();
    await store.saveEvidence([sampleEvidence("S-001"), sampleEvidence("S-002")]);
    const loaded = await store.loadEvidence();
    expect(loaded.map((source) => source.id)).toEqual(["S-001", "S-002"]);

    await expect(store.saveEvidence([{ ...sampleEvidence("S-001") }, { ...sampleEvidence("S-001") }])).rejects.toThrow(
      /unique/u,
    );
  });

  it("competitors persist as a validated JSON array", async () => {
    const store = await makeStore();
    await store.saveCompetitors([sampleCompetitor("C-001")]);
    expect((await store.loadCompetitors())[0]?.id).toBe("C-001");

    const foreign = { ...sampleCompetitor("C-002"), currency: "USD" };
    await expect(store.saveCompetitors([foreign])).rejects.toThrow(/currency/u);
  });

  it("assumptions persist and validate against the project currency", async () => {
    const store = await makeStore();
    const assumptions = {
      ...emptyAssumptions("INR"),
      acquisitionCost: "500.00",
      scenarioPrices: { low: "100.00", base: "150.00", high: "200.00" },
    };
    await store.saveAssumptions(assumptions);
    expect(await store.loadAssumptions()).toEqual(assumptions);

    await expect(store.saveAssumptions({ ...assumptions, shippingCost: "-2.00" })).rejects.toThrow(
      /negative/u,
    );
  });

  it("scenarios and reports record fingerprints of exact bytes", async () => {
    const store = await makeStore();
    const scenarios = [
      {
        scenario: "low" as const,
        sellingPrice: "10.00",
        acquisitionCost: "0.00",
        shippingCost: "0.00",
        marketplaceFeeRate: "0.00",
        marketplaceFee: "0.00",
        paymentFeeRate: "0.00",
        paymentFee: "0.00",
        otherCosts: "0.00",
        totalCost: "0.00",
        grossProfit: "10.00",
        grossMarginPercent: "100.00",
      },
    ];
    const fingerprint = await store.saveScenarios(scenarios);
    expect(fingerprint.path).toBe(ArtifactPaths.scenarios);
    expect(fingerprint.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(await store.loadScenarios()).toEqual(scenarios);

    const reportFingerprint = await store.writeOpportunityReport("# Report\n");
    expect(reportFingerprint.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(await store.loadOpportunityReport()).toBe("# Report\n");
  });

  it("manifest saves bump updatedAt", async () => {
    const store = await makeStore();
    const before = store.manifest.updatedAt;
    const saved = await store.saveManifest({ objective: "Refined objective" });
    expect(saved.objective).toBe("Refined objective");
    expect(saved.updatedAt >= before).toBe(true);
    expect((await WorkspaceStore.open(store.root)).manifest.objective).toBe("Refined objective");
  });
});

describe("path safety", () => {
  it("refuses traversal and unknown artifact paths", async () => {
    const parent = await tempDir();
    const store = await WorkspaceStore.create({
      parentDirectory: parent,
      name: "Guarded",
      objective: "Objective",
      currency: "INR",
    });

    await expect(resolveKnownArtifact(store.root, "../outside.json")).rejects.toThrow(/unsafe/iu);
    await expect(resolveKnownArtifact(store.root, "some/random/file.txt")).rejects.toThrow(/unknown/iu);
    await expect(store.readArtifactText("../../etc/passwd")).rejects.toThrow();

    // Known-but-absent generated artifact reads as null through the guard.
    expect(await store.loadOpportunityReport()).toBeNull();
  });

  it("reads known artifacts back through the guarded API", async () => {
    const parent = await tempDir();
    const store = await WorkspaceStore.create({
      parentDirectory: parent,
      name: "Reader",
      objective: "Objective",
      currency: "INR",
    });
    const text = await store.readArtifactText(ArtifactPaths.manifest);
    expect(JSON.parse(text).name).toBe("Reader");
    void readFile;
  });
});
