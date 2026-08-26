import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceStore, calculateScenarios, importV0Project } from "../src";

/**
 * Imports the real checked-in V0 example project and verifies the migrated
 * V2 workspace end-to-end, including deterministic economics on the
 * imported assumptions.
 */

const EXAMPLE_V0_ROOT = join(import.meta.dirname, "..", "..", "..", "examples", "mechanical-keyboards-india");

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "open-merchant-example-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("V0 example project import", () => {
  it("migrates mechanical-keyboards-india with intact data", async () => {
    const parent = await tempDir();
    const readFile = async (path: string): Promise<string> => {
      const { readFile: nodeReadFile } = await import("node:fs/promises");
      return nodeReadFile(path, "utf8");
    };

    const result = await importV0Project(EXAMPLE_V0_ROOT, parent, readFile);
    expect(result.importedEvidence).toBe(3);
    expect(result.importedCompetitors).toBeGreaterThan(0);

    const store = await WorkspaceStore.open(result.newRoot);
    expect(store.manifest.name).toBe("Mechanical Keyboards India");
    expect(store.manifest.currency).toBe("INR");

    // Assumptions survived the migration byte-for-byte in value terms.
    const assumptions = await store.loadAssumptions();
    expect(assumptions.acquisitionCost).toBe("1800.00");
    expect(assumptions.marketplaceFeeRate).toBe("12.00");
    expect(assumptions.scenarioPrices.base).toBe("4499.00");

    // Deterministic economics over imported inputs.
    const scenarios = calculateScenarios(assumptions);
    const base = scenarios[1];
    expect(base).toMatchObject({
      marketplaceFee: "539.88",
      paymentFee: "89.98",
      totalCost: "2729.86",
      grossProfit: "1769.14",
      grossMarginPercent: "39.32",
    });

    const low = scenarios[0];
    expect(low).toMatchObject({ totalCost: "2589.86", grossProfit: "909.14", grossMarginPercent: "25.98" });
    const high = scenarios[2];
    expect(high).toMatchObject({ totalCost: "2869.86", grossProfit: "2629.14", grossMarginPercent: "47.81" });

    // Report sections carried over.
    expect((await store.loadReportSections()).decisionSummary.length).toBeGreaterThan(0);
  });
});
