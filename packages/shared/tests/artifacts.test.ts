import { describe, expect, it } from "vitest";

import {
  AppError,
  competitorSchema,
  currencyCodeSchema,
  evidenceSourceSchema,
  manifestSchema,
  moneyStringSchema,
} from "../src";

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
});
