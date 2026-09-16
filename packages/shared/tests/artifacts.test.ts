import { describe, expect, it } from "vitest";

import {
  AppError,
  competitorSchema,
  currencyCodeSchema,
  evidenceSourceSchema,
  manifestSchema,
} from "../src";
import {
  auditReportSchema,
  competitorDraftListSchema,
  economicsReviewSchema,
  researchPlanSchema,
} from "../src/ai";
import {
  competitorStatisticsSchema,
  costAssumptionsSchema,
  decisionJournalSchema,
  economicsScenarioSchema,
  listingPriceHistorySchema,
  marginMonitorSchema,
  marketSnapshotSchema,
  portfolioEntrySchema,
  reportSectionsSchema,
  snapshotDiffSchema,
} from "../src/artifacts";
import { appErrorCodeSchema, appErrorSchema } from "../src/errors";
import { moneyStringSchema } from "../src/money";
import { provenanceRecordSchema, runRecordSchema } from "../src/provenance";
import { ipc } from "../src/ipc";
import { providerIdSchema } from "../src/ai";

const validManifest = {
  schemaVersion: 2,
  projectId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Mechanical Keyboards India",
  objective: "Decide whether to enter the enthusiast keyboard market",
  currency: "INR",
  createdAt: "2026-08-26T10:00:00.000Z",
  updatedAt: "2026-08-26T10:00:00.000Z",
};

describe("moneyStringSchema", () => {
  it("accepts decimal amounts with at most two fractional digits", () => {
    expect(moneyStringSchema.safeParse("1250").success).toBe(true);
    expect(moneyStringSchema.safeParse("1250.5").success).toBe(true);
    expect(moneyStringSchema.safeParse("1250.50").success).toBe(true);
    expect(moneyStringSchema.safeParse("-12.25").success).toBe(true);
  });

  it("rejects floats-as-strings with excess precision and non-decimal text", () => {
    expect(moneyStringSchema.safeParse("1250.500").success).toBe(false);
    expect(moneyStringSchema.safeParse("12,50").success).toBe(false);
    expect(moneyStringSchema.safeParse("").success).toBe(false);
    expect(moneyStringSchema.safeParse("abc").success).toBe(false);
  });
});

describe("currencyCodeSchema", () => {
  it("accepts exactly three uppercase letters", () => {
    expect(currencyCodeSchema.safeParse("INR").success).toBe(true);
    expect(currencyCodeSchema.safeParse("inr").success).toBe(false);
    expect(currencyCodeSchema.safeParse("INRR").success).toBe(false);
  });
});

describe("manifestSchema", () => {
  it("accepts a well-formed v2 manifest", () => {
    expect(manifestSchema.parse(validManifest)).toEqual(validManifest);
  });

  it("rejects unsupported schema versions and empty required fields", () => {
    expect(manifestSchema.safeParse({ ...validManifest, schemaVersion: 1 }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...validManifest, name: "   " }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...validManifest, objective: "" }).success).toBe(false);
  });
});

describe("evidenceSourceSchema", () => {
  const validSource = {
    id: "S-001",
    url: "https://example.com/listing",
    title: "Marketplace listing",
    notes: "",
    observations: [],
    observedAt: "2026-08-26T10:00:00.000Z",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
  };

  it("accepts a well-formed source", () => {
    expect(evidenceSourceSchema.parse(validSource)).toEqual(validSource);
  });

  it("rejects non-http URLs and malformed IDs", () => {
    expect(evidenceSourceSchema.safeParse({ ...validSource, url: "ftp://example.com" }).success).toBe(false);
    expect(evidenceSourceSchema.safeParse({ ...validSource, id: "X-001" }).success).toBe(false);
  });
});

describe("competitorSchema", () => {
  it("allows an unpriced listing via null price", () => {
    const parsed = competitorSchema.parse({
      id: "C-001",
      product: "Keyboard",
      brand: "Brand",
      price: null,
      currency: "INR",
      marketplace: "Example Bazaar",
      url: "https://example.com",
      sourceId: null,
      notes: "",
      observedAt: "2026-08-26T10:00:00.000Z",
    });
    expect(parsed.price).toBeNull();
  });
});

describe("AppError", () => {
  it("round-trips through its serialized form", () => {
    const error = new AppError({ code: "not-a-project", message: "Nope", detail: "why" });
    expect(error.toJSON()).toEqual({ code: "not-a-project", message: "Nope", detail: "why" });
    expect(error instanceof Error).toBe(true);
  });

  it("round-trips every stable error code without secrets in the shape", () => {
    for (const code of appErrorCodeSchema.options) {
      const error = new AppError({ code, message: `failed: ${code}` });
      const json = error.toJSON();
      expect(appErrorSchema.safeParse(json).success).toBe(true);
      expect(json.code).toBe(code);
      expect(JSON.stringify(json)).not.toContain("apiKey");
      expect(JSON.stringify(json)).not.toContain("sk-");
    }
  });

  it("rejects unknown codes at the contract boundary", () => {
    expect(appErrorSchema.safeParse({ code: "made-up-code", message: "x" }).success).toBe(false);
    expect(appErrorCodeSchema.safeParse("made-up-code").success).toBe(false);
  });
});

describe("provider registry", () => {
  it("accepts exactly the four supported provider ids", () => {
    expect(providerIdSchema.options).toEqual(["anthropic", "openai", "gemini", "local-openai"]);
    expect(providerIdSchema.safeParse("anthropic").success).toBe(true);
    expect(providerIdSchema.safeParse("local-openai").success).toBe(true);
    expect(providerIdSchema.safeParse("unknown-cloud").success).toBe(false);
  });
});

describe("phase-2 artifact schemas", () => {
  const statistics = {
    validPriceCount: 2,
    minimum: "499.00",
    maximum: "599.50",
    average: "549.25",
    median: "549.25",
  };

  it("accepts a fully-priced statistics block and an empty one", () => {
    expect(competitorStatisticsSchema.safeParse(statistics).success).toBe(true);
    expect(
      competitorStatisticsSchema.safeParse({
        validPriceCount: 0,
        minimum: null,
        maximum: null,
        average: null,
        median: null,
      }).success,
    ).toBe(true);
  });

  it("rejects statistics with negative counts or malformed money", () => {
    expect(
      competitorStatisticsSchema.safeParse({ ...statistics, validPriceCount: -1 }).success,
    ).toBe(false);
    expect(
      competitorStatisticsSchema.safeParse({ ...statistics, average: "12.345" }).success,
    ).toBe(false);
  });

  it("accepts priced scenarios and rejects malformed margins", () => {
    const scenario = {
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
    };
    expect(economicsScenarioSchema.safeParse(scenario).success).toBe(true);
    expect(
      economicsScenarioSchema.safeParse({ ...scenario, grossMarginPercent: "31.012" }).success,
    ).toBe(false);
  });

  it("accepts assumptions with and without the margin threshold", () => {
    const base = {
      currency: "INR",
      acquisitionCost: "500.00",
      shippingCost: "75.50",
      marketplaceFeeRate: "12.50",
      paymentFeeRate: "2.35",
      otherCosts: "20.00",
      scenarioPrices: { low: "899.99", base: "1099.99", high: "1499.99" },
    };
    expect(costAssumptionsSchema.safeParse(base).success).toBe(true);
    expect(
      costAssumptionsSchema.safeParse({ ...base, marginThresholdPercent: "20.00" }).success,
    ).toBe(true);
    expect(
      costAssumptionsSchema.safeParse({ ...base, marginThresholdPercent: "20.001" }).success,
    ).toBe(false);
  });

  it("accepts saved report sections including the empty draft shape", () => {
    expect(
      reportSectionsSchema.safeParse({
        decisionSummary: "",
        marketObservations: [],
        risks: [],
        opportunities: [],
      }).success,
    ).toBe(true);
    expect(
      reportSectionsSchema.safeParse({
        decisionSummary: "Enter with a limited batch.",
        marketObservations: ["Demand clusters around 65% layouts."],
        risks: ["Duties may erode margins."],
        opportunities: ["Bundle keycaps."],
      }).success,
    ).toBe(true);
  });

  it("accepts a market snapshot with listings and statistics", () => {
    expect(
      marketSnapshotSchema.safeParse({
        id: "SNAP-20260905T081234Z-4f2a",
        capturedAt: "2026-09-05T08:12:34.000Z",
        note: "Weekly capture",
        listingCount: 1,
        statistics: {
          validPriceCount: 1,
          minimum: "549.25",
          maximum: "549.25",
          average: "549.25",
          median: "549.25",
        },
        listings: [
          {
            id: "C-001",
            product: "Keyboard",
            brand: "Brand",
            price: "549.25",
            currency: "INR",
            marketplace: "Example Bazaar",
            url: "https://example.com",
            sourceId: null,
            notes: "",
            observedAt: "2026-09-05T08:00:00.000Z",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts snapshot diffs and per-listing price histories", () => {
    expect(
      snapshotDiffSchema.safeParse({
        fromId: "SNAP-20260905T081234Z-4f2a",
        toId: "SNAP-20260906T081234Z-9b11",
        added: [],
        removed: [],
        priceChanges: [
          {
            key: "brand | keyboard | example bazaar",
            product: "Keyboard",
            brand: "Brand",
            marketplace: "Example Bazaar",
            fromPrice: "499.00",
            toPrice: "549.25",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      listingPriceHistorySchema.safeParse({
        key: "brand | keyboard | example bazaar",
        product: "Keyboard",
        brand: "Brand",
        marketplace: "Example Bazaar",
        points: [
          {
            snapshotId: "SNAP-20260905T081234Z-4f2a",
            capturedAt: "2026-09-05T08:12:34.000Z",
            price: "499.00",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts margin monitor results in every status", () => {
    for (const status of ["healthy", "watch", "breached", "unmonitored"] as const) {
      expect(
        marginMonitorSchema.safeParse({
          thresholdPercent: "20.00",
          marketPrice: "749.00",
          marketSource: "SNAP-20260905T081234Z-4f2a",
          flags: [
            {
              scenario: "base",
              sellingPrice: "1099.99",
              grossMarginPercent: "45.86",
              marginAtMarketPrice: status === "unmonitored" ? null : "20.49",
              driftPercent: status === "unmonitored" ? null : "-25.37",
              status,
            },
          ],
        }).success,
      ).toBe(true);
    }
  });

  it("accepts decision journals with entries and stale evidence", () => {
    expect(
      decisionJournalSchema.safeParse({
        entries: [{ runId: "RUN-1", completedAt: "2026-09-05T08:12:34.000Z", status: "succeeded" }],
        staleEvidence: [
          {
            id: "S-001",
            title: "Old listing",
            observedAt: "2026-07-01T08:00:00.000Z",
            ageDays: 66,
          },
        ],
        staleAfterDays: 30,
      }).success,
    ).toBe(true);
  });

  it("accepts portfolio entries with attention-first statuses", () => {
    for (const worstStatus of ["healthy", "watch", "breached", "none"] as const) {
      expect(
        portfolioEntrySchema.safeParse({
          root: "C:/research/keyboards",
          name: "Keyboards",
          currency: "INR",
          hasReport: worstStatus !== "none",
          lastReportAt: null,
          snapshotCapturedAt: null,
          snapshotAgeDays: null,
          thresholdPercent: "20.00",
          worstStatus,
          flags: [],
        }).success,
      ).toBe(true);
    }
  });

  it("rejects malformed phase-2 payloads loudly", () => {
    expect(
      marketSnapshotSchema.safeParse({
        id: "not-a-snapshot",
        capturedAt: "2026-09-05T08:12:34.000Z",
        note: "x",
        listingCount: 0,
        statistics: {
          validPriceCount: 0,
          minimum: null,
          maximum: null,
          average: null,
          median: null,
        },
        listings: [],
      }).success,
    ).toBe(false);
    expect(
      provenanceRecordSchema.safeParse({
        runId: "RUN-1",
        artifactPath: "reports/opportunity-report.md",
        sha256: "not-a-hash",
        generatedAt: "2026-09-05T08:12:34.000Z",
        origin: { kind: "user" },
      }).success,
    ).toBe(false);
  });
});

describe("provenance and run records", () => {
  it("accepts user and agent origins", () => {
    expect(
      provenanceRecordSchema.safeParse({
        runId: "RUN-1",
        artifactPath: "reports/opportunity-report.md",
        sha256: "a".repeat(64),
        generatedAt: "2026-09-05T08:12:34.000Z",
        origin: { kind: "user" },
      }).success,
    ).toBe(true);
    expect(
      provenanceRecordSchema.safeParse({
        runId: "RUN-1",
        artifactPath: "reports/opportunity-report.md",
        sha256: "a".repeat(64),
        generatedAt: "2026-09-05T08:12:34.000Z",
        origin: {
          kind: "agent",
          agentId: "report-writer",
          providerId: "anthropic",
          modelId: "claude-test",
          promptHash: "b".repeat(64),
        },
      }).success,
    ).toBe(true);
    expect(
      runRecordSchema.safeParse({
        runId: "RUN-1",
        operation: "reportGenerated",
        startedAt: "2026-09-05T08:12:34.000Z",
        completedAt: "2026-09-05T08:12:34.000Z",
        status: "succeeded",
        appVersion: "9.9.9-test",
        inputArtifacts: [],
        outputArtifacts: [],
        errorSummary: null,
      }).success,
    ).toBe(true);
  });
});

describe("agent output schemas", () => {
  it("accepts research plans, competitor drafts, reviews, and audits", () => {
    expect(
      researchPlanSchema.safeParse({ steps: [{ title: "Map listings", why: "Ground pricing" }] })
        .success,
    ).toBe(true);
    expect(
      competitorDraftListSchema.safeParse({
        competitors: [
          { product: "Keyboard", brand: "", price: "499.00", marketplace: "", url: "" },
        ],
      }).success,
    ).toBe(true);
    expect(
      economicsReviewSchema.safeParse({
        verdict: "caution",
        summary: "Margins are thin at market.",
        findings: [{ severity: "warning", message: "Watch fees." }],
      }).success,
    ).toBe(true);
    expect(
      auditReportSchema.safeParse({
        verdict: "gaps-found",
        summary: "One claim lacks a source.",
        findings: [{ status: "unverified", claim: "Demand is rising.", note: "No source." }],
      }).success,
    ).toBe(true);
  });

  it("rejects agent payloads with bad enums or empty titles", () => {
    expect(researchPlanSchema.safeParse({ steps: [{ title: "", why: "x" }] }).success).toBe(false);
    expect(
      economicsReviewSchema.safeParse({ verdict: "fine", summary: "x", findings: [] }).success,
    ).toBe(false);
  });
});

describe("IPC contract map", () => {
  it("exposes every channel the SDK and preload bridge rely on", () => {
    const channels = Object.keys(ipc);
    for (const expected of [
      "app/info",
      "project/create",
      "project/open",
      "evidence/load",
      "evidence/save",
      "competitors/load",
      "competitors/save",
      "competitors/statistics",
      "assumptions/load",
      "assumptions/save",
      "economics/calculate",
      "report/generate",
      "snapshots/capture",
      "snapshots/list",
      "snapshots/diff",
      "snapshots/history",
      "monitor/margin",
      "journal/decision",
      "portfolio/overview",
      "csv/export",
      "csv/import",
      "archive/create",
      "archive/restore",
      "report/export-pdf",
      "ai/config/load",
      "ai/config/save",
      "ai/test",
    ] as const) {
      expect(channels).toContain(expected);
    }
  });

  it("validates the request/response shapes of the file-first pillar", () => {
    expect(ipc["csv/export"].request.safeParse({ root: "C:/r", kind: "competitors" }).success).toBe(
      true,
    );
    expect(ipc["csv/export"].request.safeParse({ root: "C:/r", kind: "pdf" }).success).toBe(false);
    expect(
      ipc["archive/restore"].request.safeParse({
        parentDirectory: "C:/r",
        archiveBase64: "e30=",
      }).success,
    ).toBe(true);
    expect(
      ipc["archive/restore"].request.safeParse({ parentDirectory: "C:/r", archiveBase64: "" })
        .success,
    ).toBe(false);
    expect(
      ipc["report/export-pdf"].response.safeParse({ saved: true, path: "C:/r/report.pdf" }).success,
    ).toBe(true);
  });

  it("strips unknown keys so secrets can never ride the contract", () => {
    const parsed = ipc["ai/config/load"].response.parse({
      activeProvider: null,
      models: {},
      hasKeys: { anthropic: true },
      baseUrls: {},
      encryptionAvailable: true,
      apiKey: "sk-live-secret",
    });
    expect(parsed).not.toHaveProperty("apiKey");
  });
});
