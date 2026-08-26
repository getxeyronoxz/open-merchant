import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ArtifactPaths, WorkspaceStore, calculateScenarios } from "@open-merchant/core";
import type { Competitor, CostAssumptions, EvidenceSource, ReportSections } from "@open-merchant/shared";
import { AppError } from "@open-merchant/shared";

import { MerchantService } from "../src/main/service";

/**
 * Deep integration coverage for MerchantService - the exact code the IPC
 * handlers invoke - against real folders in a temp directory.
 */

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-service-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeService(): MerchantService {
  return new MerchantService("9.9.9-test");
}

const NOW = "2026-08-26T09:00:00.000Z";

function source(id: string): EvidenceSource {
  return {
    id,
    url: "https://example.com/listing",
    title: `Listing ${id}`,
    notes: "",
    observations: [],
    observedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function competitor(id: string, price: string | null): Competitor {
  return {
    id,
    product: `Keyboard ${id}`,
    brand: "Keeb",
    price,
    currency: "INR",
    marketplace: "Example Bazaar",
    url: "https://example.com/market",
    sourceId: null,
    notes: "",
    observedAt: NOW,
  };
}

function assumptions(): CostAssumptions {
  return {
    currency: "INR",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "12.50",
    paymentFeeRate: "2.35",
    otherCosts: "20.00",
    scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
  };
}

function sections(): ReportSections {
  return {
    decisionSummary: "Enter with a limited first batch.",
    marketObservations: ["Demand clusters around 65% layouts."],
    risks: ["Import duties may erode margins."],
    opportunities: ["Bundle keycaps to lift average order value."],
  };
}

describe("MerchantService workflow", () => {
  it("runs create, evidence, competitors, economics, report, and reopen", async () => {
    const parent = await tempDir();
    const service = makeService();

    const created = await service.createProject({
      parentDirectory: parent,
      name: "Keyboards India",
      objective: "Decide whether to enter the Indian enthusiast keyboard market.",
      currency: "INR",
    });
    const root = created.root;

    // Creation journals exactly one succeeded projectCreated run.
    expect((await service.listRuns(root)).map((run) => run.operation)).toEqual(["projectCreated"]);

    // --- evidence ---
    await service.saveEvidence(root, [source("S-001"), source("S-002")]);
    expect((await service.loadEvidence(root)).map((entry) => entry.id)).toEqual(["S-001", "S-002"]);

    // --- competitors + exact deterministic statistics ---
    await service.saveCompetitors(root, [
      competitor("C-001", "499.00"),
      competitor("C-002", "599.50"),
      competitor("C-003", null),
    ]);
    expect(await service.competitorStatistics(root)).toEqual({
      validPriceCount: 2,
      minimum: "499.00",
      maximum: "599.50",
      average: "549.25",
      median: "549.25",
    });

    // --- assumptions + deterministic calculation (golden values) ---
    await service.saveAssumptions(root, assumptions());
    const scenarios = await service.calculateScenarios(root);
    expect(scenarios[1]).toMatchObject({
      scenario: "base",
      marketplaceFee: "137.50",
      paymentFee: "25.85",
      totalCost: "758.85",
      grossProfit: "341.14",
      grossMarginPercent: "31.01",
    });

    // --- report sections + generation ---
    const savedSections = sections();
    await service.saveReportSections(root, savedSections);
    const markdown = await service.generateReport(root);
    expect(markdown).toContain("# Keyboards India");
    expect(markdown).toContain("Generating run:");

    // Generated artifacts exist and are readable through the guarded API.
    const artifacts = await service.listArtifacts(root);
    const exists = new Map(artifacts.map((entry) => [entry.path, entry.exists]));
    expect(exists.get(ArtifactPaths.scenarios)).toBe(true);
    expect(exists.get(ArtifactPaths.opportunityReport)).toBe(true);
    expect(await service.readArtifact(root, ArtifactPaths.opportunityReport)).toContain("Keyboards India");

    // The recoverable-run flow journaled a failed run replaced by success.
    const runs = await service.listRuns(root);
    const reportRuns = runs.filter((run) => run.operation === "reportGenerated");
    expect(reportRuns).toHaveLength(1);
    expect(reportRuns[0]?.status).toBe("succeeded");

    // Provenance records the generated artifacts with user origin.
    const provenance = await service.listProvenance(root);
    expect(provenance.length).toBeGreaterThanOrEqual(2);
    for (const record of provenance) {
      expect(record.origin.kind).toBe("user");
    }

    // --- persistence across reopen ---
    const reopened = await WorkspaceStore.open(root);
    expect(reopened.manifest.name).toBe("Keyboards India");
    expect((await reopened.loadEvidence()).length).toBe(2);
  });
});

describe("MerchantService failure paths", () => {
  it("maps failures to coded AppErrors", async () => {
    const parent = await tempDir();
    const service = makeService();

    // Opening a non-project folder.
    await expect(service.openStore(parent)).rejects.toMatchObject({ code: "not-a-project" });

    // Duplicate project name in the same parent.
    const input = { parentDirectory: parent, name: "Dupe", objective: "x", currency: "INR" };
    await service.createProject(input);
    await expect(service.createProject(input)).rejects.toMatchObject({ code: "already-exists" });

    // Invalid currency at creation.
    await expect(
      service.createProject({ parentDirectory: parent, name: "Bad", objective: "x", currency: "inr" }),
    ).rejects.toMatchObject({ code: "storage-error" });

    // Negative assumption cost.
    const created = await service.createProject({
      parentDirectory: parent,
      name: "Negatives",
      objective: "x",
      currency: "INR",
    });
    await expect(
      service.saveAssumptions(created.root, {
        currency: "INR",
        acquisitionCost: "-1.00",
        shippingCost: "0.00",
        marketplaceFeeRate: "0.00",
        paymentFeeRate: "0.00",
        otherCosts: "0.00",
        scenarioPrices: { low: null, base: null, high: null },
      }),
    ).rejects.toMatchObject({ code: "invalid-input" });

    // Manifest identity mismatch on saveManifest.
    const store = await service.openStore(created.root);
    const foreign = { ...store.manifest, projectId: "00000000-0000-4000-8000-000000000000" };
    await expect(service.saveManifest(created.root, foreign)).rejects.toMatchObject({
      code: "invalid-input",
    });

    // Path traversal through readArtifact.
    await expect(
      service.readArtifact(created.root, "../../outside.txt"),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("MerchantService AI guards", () => {
  it("requires AI configuration for every agent", async () => {
    const parent = await tempDir();
    const service = makeService();
    const created = await service.createProject({
      parentDirectory: parent,
      name: "NoAi",
      objective: "Objective",
      currency: "INR",
    });
    const root = created.root;

    const unconfigured = [
      () => service.draftEvidence(root, "https://example.com", "text"),
      () => service.draftSections(root),
      () => service.draftPlan(root),
      () => service.draftCompetitors(root, "listings"),
      () => service.reviewEconomicsFor(root),
      () => service.auditGeneratedReport(root),
    ];
    for (const call of unconfigured) {
      await expect(call).rejects.toMatchObject({ code: "ai-not-configured" });
    }
  });

  it("imports the real V0 example project end to end", async () => {
    const parent = await tempDir();
    const service = makeService();
    const exampleRoot = join(import.meta.dirname, "..", "..", "..", "examples", "v0-mechanical-keyboards-india");

    const result = await service.importV0(exampleRoot, parent);
    expect(result.importedEvidence).toBe(3);
    expect(result.importedCompetitors).toBeGreaterThan(0);

    const store = await WorkspaceStore.open(result.root);
    expect(store.manifest.currency).toBe("INR");
    const assumptionsLoaded = await store.loadAssumptions();
    expect(assumptionsLoaded.scenarioPrices.base).toBe("4499.00");

    const scenarios = calculateScenarios(assumptionsLoaded);
    expect(scenarios[1]?.grossMarginPercent).toBe("39.32");
  });
});
