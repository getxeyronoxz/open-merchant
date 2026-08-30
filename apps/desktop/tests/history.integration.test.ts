import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CostAssumptions, ReportSections } from "@open-merchant/shared";

import { MerchantService } from "../src/main/service";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "om-hist-"));
  tempDirs.push(dir);
  return dir;
}

describe("generation history (MerchantService)", () => {
  it("captures a scenarios snapshot on calculation", async () => {
    const service = new MerchantService("9.9.9-test");
    const created = await service.createProject({
      parentDirectory: await tempDir(),
      name: "History Demo",
      objective: "Decide",
      currency: "INR",
    });
    await service.saveAssumptions(created.root, assumptions());
    const scenariosSnapshot = await service.calculateScenarios(created.root);
    expect(scenariosSnapshot.map((entry) => entry.scenario)).toEqual(["low", "base", "high"]);

    const runs = await service.listRuns(created.root);
    const run = runs.find((entry) => entry.operation === "economicsGenerated");
    expect(run).toBeDefined();

    const snapshot = await service.readHistory(created.root, "scenarios", run!.runId);
    expect(snapshot).toContain('"scenario": "base"');
    expect(snapshot).toContain('"scenario": "low"');
    expect(snapshot).toContain('"sellingPrice": "1099.99"');
  });

  it("captures report and scenarios snapshots on report generation", async () => {
    const service = new MerchantService("9.9.9-test");
    const created = await service.createProject({
      parentDirectory: await tempDir(),
      name: "History Demo",
      objective: "Decide",
      currency: "INR",
    });
    await service.saveAssumptions(created.root, assumptions());
    await service.saveReportSections(created.root, sections());
    const markdown = await service.generateReport(created.root);

    const runs = await service.listRuns(created.root);
    const run = runs.find(
      (entry) => entry.operation === "reportGenerated" && entry.status === "succeeded",
    );
    expect(run).toBeDefined();

    expect(await service.readHistory(created.root, "report", run!.runId)).toBe(markdown);
    expect(await service.readHistory(created.root, "scenarios", run!.runId)).toContain(
      '"scenario": "base"',
    );
  });

  it("returns null for unknown generations and rejects unsafe run ids", async () => {
    const service = new MerchantService("9.9.9-test");
    const created = await service.createProject({
      parentDirectory: await tempDir(),
      name: "History Demo",
      objective: "Decide",
      currency: "INR",
    });

    expect(await service.readHistory(created.root, "report", "RUN-missing")).toBeNull();
    await expect(service.readHistory(created.root, "report", "../evil")).rejects.toThrow();
  });
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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