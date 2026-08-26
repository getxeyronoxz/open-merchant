import { describe, expect, it } from "vitest";

import type {
  Competitor,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  Manifest,
  ReportSections,
} from "@open-merchant/shared";

import { DomainError, calculateScenarios } from "../src/economics";
import { renderOpportunityReport, type ReportInput } from "../src/report";
import { competitorStatistics } from "../src/statistics";
import {
  ValidationError,
  validateAssumptions,
  validateCompetitors,
  validateCurrency,
  validateEvidenceSources,
} from "../src/validation";

/**
 * Golden parity fixtures for the legacy Rust engine (`merchant-core`).
 * Expected values are derived from the Rust implementation's exact
 * operation order and rounding points: full-precision intermediates, each
 * emitted field rounded independently half-away-from-zero to two decimals.
 */

const E1_ASSUMPTIONS: CostAssumptions = {
  currency: "INR",
  acquisitionCost: "500.00",
  shippingCost: "75.50",
  marketplaceFeeRate: "12.50",
  paymentFeeRate: "2.35",
  otherCosts: "20.00",
  scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
};

describe("golden: economics scenarios", () => {
  it("E1 standard case matches legacy outputs exactly", () => {
    const scenarios = calculateScenarios(E1_ASSUMPTIONS);

    // Hand-computed from the Rust semantics:
    //   low : fee 112.49875 -> 112.50 | pay 21.149765 -> 21.15
    //         total 729.148515 -> 729.15 | profit 170.841485 -> 170.84 | margin 18.98
    //   base: fee 137.49875 -> 137.50 | pay 25.849765 -> 25.85
    //         total 758.848515 -> 758.85 | profit 341.141485 -> 341.14 | margin 31.01
    //   high: fee 187.49875 -> 187.50 | pay 35.249765 -> 35.25
    //         total 818.248515 -> 818.25 | profit 681.741485 -> 681.74 | margin 45.45
    const expected: EconomicsScenario[] = [
      {
        scenario: "low",
        sellingPrice: "899.99",
        acquisitionCost: "500.00",
        shippingCost: "75.50",
        marketplaceFeeRate: "12.50",
        marketplaceFee: "112.50",
        paymentFeeRate: "2.35",
        paymentFee: "21.15",
        otherCosts: "20.00",
        totalCost: "729.15",
        grossProfit: "170.84",
        grossMarginPercent: "18.98",
      },
      {
        scenario: "base",
        sellingPrice: "1099.99",
        acquisitionCost: "500.00",
        shippingCost: "75.50",
        marketplaceFeeRate: "12.50",
        marketplaceFee: "137.50",
        paymentFeeRate: "2.35",
        paymentFee: "25.85",
        otherCosts: "20.00",
        totalCost: "758.85",
        grossProfit: "341.14",
        grossMarginPercent: "31.01",
      },
      {
        scenario: "high",
        sellingPrice: "1499.99",
        acquisitionCost: "500.00",
        shippingCost: "75.50",
        marketplaceFeeRate: "12.50",
        marketplaceFee: "187.50",
        paymentFeeRate: "2.35",
        paymentFee: "35.25",
        otherCosts: "20.00",
        totalCost: "818.25",
        grossProfit: "681.74",
        grossMarginPercent: "45.45",
      },
    ];
    expect(scenarios).toEqual(expected);
  });

  it("E2 half-cent ties round away from zero", () => {
    // fee(2.50 @ 5%) = 0.125 -> 0.13; profit 2.375 -> 2.38
    const scenarios = calculateScenarios({
      currency: "INR",
      acquisitionCost: "0.00",
      shippingCost: "0.00",
      marketplaceFeeRate: "5.00",
      paymentFeeRate: "0.00",
      otherCosts: "0.00",
      scenarioPrices: { low: "2.50", base: "100.00", high: "200.00" },
    });
    expect(scenarios[0]).toMatchObject({
      marketplaceFee: "0.13",
      totalCost: "0.13",
      grossProfit: "2.38",
      grossMarginPercent: "95.00",
    });
    expect(scenarios[1]).toMatchObject({ totalCost: "5.00", grossProfit: "95.00" });
    expect(scenarios[2]).toMatchObject({ totalCost: "10.00", grossProfit: "190.00" });
  });

  it("E3 loss-making scenarios keep signs through rounding", () => {
    const scenarios = calculateScenarios({
      currency: "INR",
      acquisitionCost: "800.00",
      shippingCost: "50.00",
      marketplaceFeeRate: "10.00",
      paymentFeeRate: "2.00",
      otherCosts: "30.00",
      scenarioPrices: { low: "500.00", base: "600.00", high: "900.00" },
    });
    expect(scenarios[0]).toMatchObject({
      totalCost: "940.00",
      grossProfit: "-440.00",
      grossMarginPercent: "-88.00",
    });
    expect(scenarios[1]).toMatchObject({ grossProfit: "-352.00", grossMarginPercent: "-58.67" });
    expect(scenarios[2]).toMatchObject({ grossProfit: "-88.00", grossMarginPercent: "-9.78" });
  });

  it("rejects missing or non-positive prices like the legacy engine", () => {
    expect(() =>
      calculateScenarios({ ...E1_ASSUMPTIONS, scenarioPrices: { low: null, base: "10.00", high: "20.00" } }),
    ).toThrow(DomainError);
    expect(() =>
      calculateScenarios({ ...E1_ASSUMPTIONS, scenarioPrices: { low: "0.00", base: "10.00", high: "20.00" } }),
    ).toThrow(/positive/u);
    expect(() =>
      calculateScenarios({ ...E1_ASSUMPTIONS, scenarioPrices: { low: "-5.00", base: "10.00", high: "20.00" } }),
    ).toThrow(/positive/u);
  });
});

function pricedCompetitor(id: string, price: string | null): Competitor {
  return {
    id,
    product: "Keyboard",
    brand: "Brand",
    price,
    currency: "INR",
    marketplace: "Example Bazaar",
    url: "https://example.com",
    sourceId: null,
    notes: "",
    observedAt: "2026-08-26T09:00:00.000Z",
  };
}

describe("golden: competitor statistics", () => {
  it("S1 four valid prices plus one unpriced listing", () => {
    const stats = competitorStatistics([
      pricedCompetitor("C-001", "499.00"),
      pricedCompetitor("C-002", "599.50"),
      pricedCompetitor("C-003", null),
      pricedCompetitor("C-004", "750.00"),
      pricedCompetitor("C-005", "1200.99"),
    ]);
    // avg 3049.49 / 4 = 762.3725 -> 762.37; median (599.50 + 750) / 2 = 674.75
    expect(stats).toEqual({
      validPriceCount: 4,
      minimum: "499.00",
      maximum: "1200.99",
      average: "762.37",
      median: "674.75",
    });
  });

  it("S2 odd count picks the middle price", () => {
    const stats = competitorStatistics([
      pricedCompetitor("C-001", "30.00"),
      pricedCompetitor("C-002", "10.00"),
      pricedCompetitor("C-003", "20.00"),
    ]);
    expect(stats).toEqual({
      validPriceCount: 3,
      minimum: "10.00",
      maximum: "30.00",
      average: "20.00",
      median: "20.00",
    });
  });

  it("S4 half-cent medians and averages round away from zero", () => {
    const stats = competitorStatistics([
      pricedCompetitor("C-001", "10.01"),
      pricedCompetitor("C-002", "10.00"),
    ]);
    // avg 20.01/2 = 10.005 -> 10.01; median likewise
    expect(stats.average).toBe("10.01");
    expect(stats.median).toBe("10.01");
  });

  it("S5 averages beyond two decimals round once at emission", () => {
    const stats = competitorStatistics([
      pricedCompetitor("C-001", "1.00"),
      pricedCompetitor("C-002", "1.00"),
      pricedCompetitor("C-003", "1.01"),
      pricedCompetitor("C-004", "1.02"),
    ]);
    // sum 4.03 / 4 = 1.0075 -> 1.01; median (1.00 + 1.01)/2 = 1.005 -> 1.01
    expect(stats.average).toBe("1.01");
    expect(stats.median).toBe("1.01");
  });

  it("S3 no prices at all yields nulls", () => {
    const stats = competitorStatistics([pricedCompetitor("C-001", null)]);
    expect(stats).toEqual({ validPriceCount: 0, minimum: null, maximum: null, average: null, median: null });
    expect(competitorStatistics([])).toEqual(stats);
  });
});

const R1_MANIFEST: Manifest = {
  schemaVersion: 2,
  projectId: "11111111-2222-3333-4444-555555555555",
  name: "Mechanical Keyboards India",
  objective: "Decide whether to enter the Indian enthusiast keyboard market.",
  currency: "INR",
  createdAt: "2026-08-26T09:00:00.000Z",
  updatedAt: "2026-08-26T09:00:00.000Z",
};

const R1_SECTIONS: ReportSections = {
  decisionSummary: "Enter with a limited first batch.",
  marketObservations: ["Demand clusters around 65% layouts.", "Buyers cite lack of local warranty."],
  risks: ["Import duties may erode margins."],
  opportunities: ["Bundle keycaps to lift average order value."],
};

const R1_EVIDENCE: EvidenceSource[] = [
  {
    id: "S-001",
    url: "https://example.com/keyboards",
    title: "Marketplace category page",
    notes: "",
    observations: [],
    observedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
  },
  {
    id: "S-002",
    url: "https://forum.example.com/thread/123",
    title: "Community survey thread",
    notes: "",
    observations: [],
    observedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
  },
];

describe("golden: report rendering", () => {
  const input: ReportInput = {
    manifest: R1_MANIFEST,
    sections: R1_SECTIONS,
    evidence: R1_EVIDENCE,
    competitorStatistics: competitorStatistics([
      pricedCompetitor("C-001", "499.00"),
      pricedCompetitor("C-002", "599.50"),
      pricedCompetitor("C-003", null),
      pricedCompetitor("C-004", "750.00"),
      pricedCompetitor("C-005", "1200.99"),
    ]),
    scenarios: calculateScenarios(E1_ASSUMPTIONS),
    runId: "RUN-test-0001",
    generatedAt: "2026-08-26T09:30:00+00:00",
  };

  it("R1 renders byte-identical markdown to the legacy renderer", () => {
    const expected = [
      "# Mechanical Keyboards India\n\n",
      "Generated: 2026-08-26T09:30:00+00:00\n\n",
      "## Research objective\n\nDecide whether to enter the Indian enthusiast keyboard market.\n\n",
      "## Decision summary\n\nEnter with a limited first batch.\n\n",
      "## Market observations\n\n- Demand clusters around 65% layouts.\n- Buyers cite lack of local warranty.\n\n",
      "## Competitor price statistics\n\n",
      "- Priced competitors: 4\n",
      "- Price range: INR 499.00–1200.99\n",
      "- Average price: INR 762.37\n",
      "- Median price: INR 674.75\n\n",
      "## Pricing and unit economics\n\n",
      "| Scenario | Price | Total cost | Gross profit | Margin |\n|---|---:|---:|---:|---:|\n",
      "| Low | INR 899.99 | 729.15 | 170.84 | 18.98% |\n",
      "| Base | INR 1099.99 | 758.85 | 341.14 | 31.01% |\n",
      "| High | INR 1499.99 | 818.25 | 681.74 | 45.45% |\n\n",
      "## Risks\n\n- Import duties may erode margins.\n\n",
      "## Opportunities\n\n- Bundle keycaps to lift average order value.\n\n",
      "## Evidence index\n\n",
      "- [S-001] [Marketplace category page](https://example.com/keyboards)\n",
      "- [S-002] [Community survey thread](https://forum.example.com/thread/123)\n\n",
      "---\nGenerating run: RUN-test-0001\n",
    ].join("");
    expect(renderOpportunityReport(input)).toBe(expected);
  });

  it("R2 empty project falls back exactly like the legacy renderer", () => {
    const markdown = renderOpportunityReport({
      manifest: R1_MANIFEST,
      sections: { decisionSummary: "", marketObservations: [], risks: [], opportunities: [] },
      evidence: [],
      competitorStatistics: { validPriceCount: 0, minimum: null, maximum: null, average: null, median: null },
      scenarios: [],
      runId: "RUN-empty",
      generatedAt: "2026-08-26T09:30:00+00:00",
    });
    expect(markdown).toContain("No decision summary recorded.");
    expect(markdown).toContain("No observations recorded.");
    expect(markdown).toContain("No valid competitor prices recorded.");
    expect(markdown).toContain("No scenarios calculated.");
    expect(markdown).toContain("No risks recorded.");
    expect(markdown).toContain("No opportunities recorded.");
    expect(markdown).toContain("No evidence recorded.");
    expect(markdown.endsWith("---\nGenerating run: RUN-empty\n")).toBe(true);
  });
});

describe("validation rules ported from the legacy engine", () => {
  const validEvidence: EvidenceSource = {
    id: "S-009",
    url: "https://example.com/keyboards",
    title: "Marketplace category page",
    notes: "",
    observations: [],
    observedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
  };

  it("requires unique S-prefixed http(s) sources with titles", () => {
    validateEvidenceSources([validEvidence]);
    expect(() => validateEvidenceSources([{ ...validEvidence, url: "ftp://example.com" }])).toThrow(
      ValidationError,
    );
    expect(() => validateEvidenceSources([{ ...validEvidence }, { ...validEvidence }])).toThrow(
      /unique/u,
    );
    expect(() => validateEvidenceSources([{ ...validEvidence, title: "  " }])).toThrow(ValidationError);
  });

  it("competitors must match project currency and non-negative prices", () => {
    validateCompetitors([pricedCompetitor("C-010", "10.00")], "INR");
    expect(() => validateCompetitors([pricedCompetitor("X-010", "10.00")], "INR")).toThrow(/C-/u);
    expect(() => validateCompetitors([pricedCompetitor("C-010", "-1.00")], "INR")).toThrow(/negative/u);
    expect(() => validateCompetitors([pricedCompetitor("C-010", "10.00")], "USD")).toThrow(/currency/u);
  });

  it("assumptions bound costs, rates, and scenario prices", () => {
    validateAssumptions(E1_ASSUMPTIONS, "INR");
    expect(() => validateAssumptions({ ...E1_ASSUMPTIONS, currency: "USD" }, "INR")).toThrow(/currency/u);
    expect(() => validateAssumptions({ ...E1_ASSUMPTIONS, acquisitionCost: "-1.00" }, "INR")).toThrow(
      /cannot be negative/u,
    );
    expect(() => validateAssumptions({ ...E1_ASSUMPTIONS, marketplaceFeeRate: "100.01" }, "INR")).toThrow(
      /between 0 and 100/u,
    );
    expect(() =>
      validateAssumptions({ ...E1_ASSUMPTIONS, scenarioPrices: { ...E1_ASSUMPTIONS.scenarioPrices, base: "0.00" } }, "INR"),
    ).toThrow(/must be positive/u);
  });

  it("currency shape check mirrors the legacy rule", () => {
    validateCurrency("INR");
    expect(() => validateCurrency("inr")).toThrow(ValidationError);
    expect(() => validateCurrency("INRR")).toThrow(ValidationError);
  });
});
