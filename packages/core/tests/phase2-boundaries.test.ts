import { describe, expect, it } from "vitest";

import type { CostAssumptions, EvidenceSource, MarginFlag } from "@open-merchant/shared";

import { importCompetitorsFromCsv, serializeCompetitorsCsv } from "../src/csv";
import { decisionJournal, STALE_AFTER_DAYS } from "../src/decision-journal";
import { calculateScenarios } from "../src/economics";
import { marginMonitor, worstFlagStatus } from "../src/monitor";

/**
 * Extra test ways for the phase-2 features: exact threshold boundaries of
 * the margin monitor, the strict staleness window of the decision journal,
 * and unicode-safe CSV round-trips of the file-first pillar. Unicode test
 * text is written as \\uXXXX escapes so this file stays pure ASCII and the
 * runtime comparison is byte-exact.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-05T12:00:00.000Z");

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

const scenarios = calculateScenarios(assumptions("20.00"));

function flag(
  scenario: MarginFlag["scenario"],
  status: MarginFlag["status"],
): Pick<MarginFlag, "scenario" | "status"> {
  return { scenario, status };
}

function evidence(id: string, observedAt: string): EvidenceSource {
  return {
    id,
    url: "https://example.com/listing",
    title: `Source ${id}`,
    notes: "",
    observations: [],
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

describe("margin monitor - exact threshold boundaries (direct API)", () => {
  it("marks watch when the market margin sits exactly at the threshold", () => {
    // Market 1191.00 prices the base scenario at exactly 50.00%:
    // (1191.00 - 595.50)/1191.00 x 100 = 50.000.
    const result = marginMonitor(assumptions("50.00"), scenarios, "1191.00", "snap-at-threshold");
    const base = result.flags.find((entry) => entry.scenario === "base");
    expect(base?.marginAtMarketPrice).toBe("50.00");
    // At-threshold is not below it, but it is inside the 5-point watch band.
    expect(base?.status).toBe("watch");
  });

  it("marks healthy when the market margin sits exactly at threshold + watch buffer", () => {
    // Market 794.00 prices the base scenario at exactly 25.00%.
    const result = marginMonitor(assumptions("20.00"), scenarios, "794.00", "snap-buffer-edge");
    const base = result.flags.find((entry) => entry.scenario === "base");
    expect(base?.marginAtMarketPrice).toBe("25.00");
    expect(base?.status).toBe("healthy");
  });

  it("reports upward drift exactly and without a minus sign", () => {
    // Market 1400.00 -> 57.46% vs the current base 45.86%.
    const result = marginMonitor(assumptions("20.00"), scenarios, "1400.00", "snap-upside");
    const base = result.flags.find((entry) => entry.scenario === "base");
    expect(base?.driftPercent).toBe("11.60");
  });

  it("degrades a malformed market price to unmonitored instead of throwing", () => {
    const result = marginMonitor(assumptions("20.00"), scenarios, "not-a-price", "snap-malformed");
    expect(result.marketPrice).toBe("not-a-price");
    expect(result.flags).toHaveLength(3);
    for (const entry of result.flags) {
      expect(entry.status).toBe("unmonitored");
      expect(entry.marginAtMarketPrice).toBeNull();
      expect(entry.driftPercent).toBeNull();
    }
  });

  it("treats a zero market price as unpriceable too", () => {
    const result = marginMonitor(assumptions("20.00"), scenarios, "0.00", "snap-zero");
    for (const entry of result.flags) expect(entry.status).toBe("unmonitored");
  });

  it("keeps the worst-status ranking honest across mixed orderings", () => {
    expect(worstFlagStatus([])).toBe("none");
    expect(worstFlagStatus([flag("base", "healthy")])).toBe("healthy");
    expect(worstFlagStatus([flag("high", "watch")])).toBe("watch");
    // Breached dominates regardless of its position in the list.
    expect(
      worstFlagStatus([flag("base", "healthy"), flag("low", "breached"), flag("high", "watch")]),
    ).toBe("breached");
  });
});

describe("decision journal - strict staleness window", () => {
  it("treats evidence exactly STALE_AFTER_DAYS old as current, one millisecond more as stale", () => {
    const exact = new Date(NOW.getTime() - STALE_AFTER_DAYS * DAY_MS).toISOString();
    const oneMsMore = new Date(NOW.getTime() - STALE_AFTER_DAYS * DAY_MS - 1).toISOString();
    const journal = decisionJournal(
      [],
      [evidence("E-EXACT", exact), evidence("E-MILLIS", oneMsMore)],
      NOW,
    );
    // The filter is strict: exactly 30 days is still current.
    expect(journal.staleEvidence.map((entry) => entry.id)).toEqual(["E-MILLIS"]);
    expect(journal.staleEvidence[0]?.ageDays).toBe(STALE_AFTER_DAYS);
  });

  it("returns the dated shape intact for an empty project", () => {
    const journal = decisionJournal([], [], NOW);
    expect(journal.entries).toEqual([]);
    expect(journal.staleEvidence).toEqual([]);
    expect(journal.staleAfterDays).toBe(STALE_AFTER_DAYS);
  });
});

describe("file-first CSV - unicode round-trip", () => {
  it("preserves Devanagari titles and rupee notes through serialize/import", () => {
    const competitor = {
      id: "C-100",
      product: "\u0915\u0941\u0930\u094D\u0924\u093E \u0938\u0947\u091F, \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E",
      brand: "Anouk",
      price: "1499.00",
      currency: "INR",
      marketplace: "Example Bazaar",
      url: "https://example.com/kurta",
      sourceId: null,
      notes: "\u0926\u0940\u0935\u093E\u0932\u0940 \u0938\u0947\u0932 \u20B91,499",
      observedAt: "2026-09-01T09:00:00.000Z",
    };
    const text = serializeCompetitorsCsv([competitor]);
    const result = importCompetitorsFromCsv(text, {}, "INR");
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.competitors.length).toBe(1);
    // The embedded comma survives quoting; the escaped Devanagari text and
    // the rupee figure survive the round-trip byte-for-byte.
    expect(result.competitors[0]?.product).toBe(
      "\u0915\u0941\u0930\u094D\u0924\u093E \u0938\u0947\u091F, \u092A\u094D\u0930\u0940\u092E\u093F\u092F\u092E",
    );
    expect(result.competitors[0]?.notes).toBe("\u0926\u0940\u0935\u093E\u0932\u0940 \u0938\u0947\u0932 \u20B91,499");
    expect(result.competitors[0]?.price).toBe("1499.00");
  });
});
