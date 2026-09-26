import { describe, expect, it } from "vitest";

import {
  conversionRateSchema,
  currencyChangePreviewSchema,
  currencyChangeRecordSchema,
  runRecordSchema,
} from "../src/provenance";

/**
 * The currency change is the one operation in this app that rewrites every
 * artifact a project owns. Its record is what makes that auditable and
 * reversible, so these tests are about the journal being unable to lie: a
 * `currencyChanged` run must carry the change it made, and no other run may
 * carry one at all.
 */

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function record(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    runId: "RUN-1",
    fromCurrency: "INR",
    toCurrency: "EUR",
    rate: "0.011",
    changedAt: "2026-09-26T09:00:00.000Z",
    affectedArtifacts: [{ path: "economics/assumptions.json", sha256: HASH }],
    beforeHash: HASH,
    afterHash: OTHER_HASH,
    oldValues: { "economics/assumptions.json#acquisitionCost": "500.00" },
    newValues: { "economics/assumptions.json#acquisitionCost": "5.50" },
    ...overrides,
  };
}

function run(operation: string, extra: Record<string, unknown> = {}) {
  return {
    runId: "RUN-1",
    operation,
    startedAt: "2026-09-26T09:00:00.000Z",
    completedAt: "2026-09-26T09:00:00.000Z",
    status: "succeeded",
    appVersion: "1.0.0",
    inputArtifacts: [],
    outputArtifacts: [],
    errorSummary: null,
    ...extra,
  };
}

describe("runRecordSchema.currencyChange", () => {
  it("accepts a currencyChanged run that carries the change it made", () => {
    const parsed = runRecordSchema.parse(run("currencyChanged", { currencyChange: record() }));

    expect(parsed.currencyChange?.toCurrency).toBe("EUR");
  });

  it("accepts a currencyChanged run that failed, with no record to describe", () => {
    // A change that could not land has nothing to describe, and the journal has
    // to be able to say so. Requiring a payload on a failure would make the
    // attempt unrecordable.
    const result = runRecordSchema.safeParse(
      run("currencyChanged", { status: "failed", errorSummary: "disk went away" }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a failed currencyChanged run that carries a record anyway", () => {
    const result = runRecordSchema.safeParse(
      run("currencyChanged", { status: "failed", errorSummary: "boom", currencyChange: record() }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a currencyChanged run with no record of what it changed", () => {
    // A run that says it changed the currency and cannot say what it wrote is
    // the exact record this design refuses to produce.
    const result = runRecordSchema.safeParse(run("currencyChanged"));

    expect(result.success).toBe(false);
  });

  it("rejects a currency change attached to any other operation", () => {
    for (const operation of ["projectCreated", "reportGenerated", "reviewSnoozed", "imported"]) {
      const result = runRecordSchema.safeParse(run(operation, { currencyChange: record() }));

      expect(result.success).toBe(false);
    }
  });

  it("leaves the review payload rules alone", () => {
    // The two payloads are independent: a review run still needs its
    // disposition, and still must not carry a currency change.
    const snoozed = runRecordSchema.safeParse(run("reviewSnoozed", { currencyChange: record() }));
    expect(snoozed.success).toBe(false);

    expect(runRecordSchema.safeParse(run("reportGenerated")).success).toBe(true);
    expect(
      runRecordSchema.safeParse(run("currencyChanged", { status: "failed" })).success,
    ).toBe(true);
  });
});

describe("currencyChangeRecordSchema", () => {
  it("round-trips the old and new value maps", () => {
    const parsed = currencyChangeRecordSchema.parse(record());

    expect(parsed.oldValues["economics/assumptions.json#acquisitionCost"]).toBe("500.00");
    expect(parsed.newValues["economics/assumptions.json#acquisitionCost"]).toBe("5.50");
  });

  it("requires at least one affected artifact", () => {
    expect(
      currencyChangeRecordSchema.safeParse(record({ affectedArtifacts: [] })).success,
    ).toBe(false);
  });

  it("rejects a rate that is not a positive decimal", () => {
    for (const rate of ["0", "0.00", "-1", "1e5", "0.011 ", ""]) {
      expect(currencyChangeRecordSchema.safeParse(record({ rate })).success).toBe(false);
    }
  });
});

describe("conversionRateSchema", () => {
  it.each(["0.011", "12", "83.25", "0.000000000001", "1.5"])("admits %s", (rate) => {
    expect(conversionRateSchema.safeParse(rate).success).toBe(true);
  });

  it.each(["0", "0.0", "0.000", "00.5", "-1", "1,5", "abc", ""])("rejects %s", (rate) => {
    // A rate of zero would restate every amount in the project as 0.00 with no
    // way back, so zero is not a rate.
    expect(conversionRateSchema.safeParse(rate).success).toBe(false);
  });
});

describe("currencyChangePreviewSchema", () => {
  const preview = {
    fromCurrency: "INR",
    toCurrency: "EUR",
    rate: "0.011",
    createdAt: "2026-09-26T09:00:00.000Z",
    affectedArtifacts: [{ path: "economics/assumptions.json", sha256: HASH }],
    beforeHash: HASH,
    afterHash: OTHER_HASH,
    oldValues: { "a#b": "500.00" },
    newValues: { "a#b": "5.50" },
    changedCount: 1,
  };

  it("carries the value maps, so the UI can show a diff rather than a promise", () => {
    const parsed = currencyChangePreviewSchema.parse(preview);

    expect(parsed.oldValues).toEqual({ "a#b": "500.00" });
    expect(parsed.changedCount).toBe(1);
  });

  it("admits a preview that changes no amounts", () => {
    // A project with no priced competitors still changes its currency code.
    const result = currencyChangePreviewSchema.safeParse({
      ...preview,
      oldValues: {},
      newValues: {},
      changedCount: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a count that disagrees with the maps", () => {
    expect(currencyChangePreviewSchema.safeParse({ ...preview, changedCount: 4 }).success).toBe(
      false,
    );
  });
});
