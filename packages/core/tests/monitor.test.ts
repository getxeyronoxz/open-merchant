import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CostAssumptions } from "@open-merchant/shared";

import { calculateScenarios } from "../src/economics";
import { marginMonitor } from "../src/monitor";
import { WorkspaceStore } from "../src/store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function assumptions(threshold: string | null): CostAssumptions {
  return {
    currency: "INR",
    acquisitionCost: "500.00",
    shippingCost: "75.50",
    marketplaceFeeRate: "0.00",
    paymentFeeRate: "0.00",
    otherCosts: "20.00",
    scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    marginThresholdPercent: threshold,
  };
}

async function storeWithSnapshot(median: string) {
  const parent = await mkdtemp(join(tmpdir(), "open-merchant-monitor-"));
  tempDirs.push(parent);
  const store = await WorkspaceStore.create({
    parentDirectory: parent,
    name: "Monitor Project",
    objective: "Decide market entry",
    currency: "INR",
  });
  // A single listing prices the snapshot statistics: min = max = avg = median.
  await store.saveCompetitors([
    {
      id: "C-001",
      product: "Reference listing",
      brand: "Brand",
      price: median,
      currency: "INR",
      marketplace: "Example Bazaar",
      url: "https://example.com",
      sourceId: null,
      notes: "",
      observedAt: "2026-09-05T09:00:00.000Z",
    },
  ]);
  await store.captureMarketSnapshot("reference");
  return store;
}

describe("margin monitor", () => {
  const assumptions_ = assumptions(null);
  const scenarios = calculateScenarios(assumptions_);

  it("computes margins at the market price with exact-decimal rounding", async () => {
    // totalCost = 595.50; base sell 1099.99 → margin 45.86%;
    // market 749.00 → margin (749 − 595.5)/749 × 100 = 20.49%.
    const store = await storeWithSnapshot("749.00");
    const snapshots = await store.listMarketSnapshots();
    const result = marginMonitor(
      assumptions("20.00"),
      scenarios,
      (snapshots[0] as (typeof snapshots)[number]).statistics.median,
      (snapshots[0] as (typeof snapshots)[number]).id,
    );

    expect(result.marketPrice).toBe("749.00");
    expect(result.thresholdPercent).toBe("20.00");
    const base = result.flags.find((flag) => flag.scenario === "base") as (typeof result.flags)[number];
    expect(base.grossMarginPercent).toBe("45.86");
    expect(base.marginAtMarketPrice).toBe("20.49");
    expect(base.driftPercent).toBe("-25.37");
    // 20.49 is at/above the 20.00 threshold but inside the 5-point watch band.
    expect(base.status).toBe("watch");
  });

  it("flags breached when market margin falls below the threshold", async () => {
    const store = await storeWithSnapshot("749.00");
    const snapshots = await store.listMarketSnapshots();
    const result = marginMonitor(
      assumptions("25.00"),
      scenarios,
      (snapshots[0] as (typeof snapshots)[number]).statistics.median,
      (snapshots[0] as (typeof snapshots)[number]).id,
    );
    for (const flag of result.flags) {
      // Every scenario's market margin (20.49%) is below 25.
      expect(flag.status).toBe("breached");
    }
  });

  it("reports healthy when market margin clears the threshold band", async () => {
    const store = await storeWithSnapshot("1400.00");
    const snapshots = await store.listMarketSnapshots();
    const result = marginMonitor(
      assumptions("20.00"),
      scenarios,
      (snapshots[0] as (typeof snapshots)[number]).statistics.median,
      (snapshots[0] as (typeof snapshots)[number]).id,
    );
    const base = result.flags.find((flag) => flag.scenario === "base") as (typeof result.flags)[number];
    // Market margin at 1400.00 = (1400 − 595.5)/1400 × 100 = 57.46% — healthy.
    expect(base.marginAtMarketPrice).toBe("57.46");
    expect(base.status).toBe("healthy");
  });

  it("is unmonitored without a threshold or without a snapshot", async () => {
    const noThreshold = marginMonitor(assumptions(null), scenarios, "749.00", null);
    expect(noThreshold.flags.every((flag) => flag.status === "unmonitored")).toBe(true);

    const noMarket = marginMonitor(assumptions("20.00"), scenarios, null, null);
    expect(noMarket.flags.every((flag) => flag.status === "unmonitored")).toBe(true);
    expect(noMarket.marketPrice).toBeNull();
    expect(noMarket.marketSource).toBeNull();
  });
});