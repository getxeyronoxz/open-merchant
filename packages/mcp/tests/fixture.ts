import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WorkspaceStore } from "@open-merchant/core";
import type { Competitor, EconomicsScenario, EvidenceSource } from "@open-merchant/shared";

/** A real project folder on disk, built through the same store the app uses. */
export interface Fixture {
  readonly parent: string;
  readonly root: string;
  readonly store: WorkspaceStore;
  readonly snapshotId: string;
}

const NOW = "2026-09-01T10:00:00.000Z";

const source: EvidenceSource = {
  id: "S-001",
  url: "https://example.com/keyboard-market",
  title: "Keyboard market thread",
  notes: "Seller-reported medians; treat as directional.",
  observations: [
    { id: "obs-1", label: "Median listing price", value: "4999", unit: "INR", note: "forum median" },
  ],
  observedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const competitor: Competitor = {
  id: "C-001",
  product: "Keychron K2",
  brand: "Keychron",
  price: "4999.00",
  currency: "INR",
  marketplace: "Amazon.in",
  url: "https://example.com/keychron-k2",
  sourceId: "S-001",
  notes: "Baseline listing.",
  observedAt: NOW,
};

function scenario(sellingPrice: string, totalCost: string, grossProfit: string, margin: string): EconomicsScenario {
  return {
    scenario: "base",
    sellingPrice,
    acquisitionCost: "2100.00",
    shippingCost: "350.00",
    marketplaceFeeRate: "18.00",
    marketplaceFee: "809.82",
    paymentFeeRate: "2.00",
    paymentFee: "89.98",
    otherCosts: "150.00",
    totalCost,
    grossProfit,
    grossMarginPercent: margin,
  };
}

export async function createFixture(options: { readonly report?: boolean } = {}): Promise<Fixture> {
  const parent = await mkdtemp(join(tmpdir(), "om-mcp-fixture-"));
  const store = await WorkspaceStore.create({
    parentDirectory: parent,
    name: "MCP Fixture",
    objective: "Does the MCP lane read the record?",
    currency: "INR",
  });
  await store.saveEvidence([source]);
  await store.saveCompetitors([competitor]);
  await store.saveScenarios([
    { ...scenario("4499.00", "3499.80", "999.20", "22.21"), scenario: "low" },
    scenario("4999.00", "3799.80", "1199.20", "24.00"),
    { ...scenario("5499.00", "4099.80", "1399.20", "25.44"), scenario: "high" },
  ]);
  if (options.report !== false) {
    await store.writeOpportunityReport("# Opportunity\n\nEnter with evidence in hand.\n");
  }
  const { snapshot } = await store.captureMarketSnapshot("fixture snapshot");
  return { parent, root: store.root, store, snapshotId: snapshot.id };
}

export async function cleanupFixture(fixture: Fixture): Promise<void> {
  await rm(fixture.parent, { recursive: true, force: true });
}
