import type {
  Competitor,
  CostAssumptions,
  EvidenceSource,
} from "@open-merchant/shared";
import { competitorIdSchema, currencyCodeSchema, evidenceSourceIdSchema } from "@open-merchant/shared";

import { Decimal, parseAmount } from "./money";

/**
 * Workspace validation rules, ported from the legacy Rust engine: malformed
 * or out-of-range data is rejected with a specific reason — never silently
 * repaired. Every check throws on the first failure found.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const HTTP_PREFIXES = ["https://", "http://"] as const;
const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function fail(message: string): never {
  throw new ValidationError(message);
}

function amountOf(raw: string): Decimal {
  try {
    return parseAmount(raw);
  } catch {
    return fail(`Invalid decimal amount: ${JSON.stringify(raw)}`);
  }
}

export function validateProjectName(value: string): void {
  if (value.trim().length === 0) fail("Project name is required");
}

export function validateObjective(value: string): void {
  if (value.trim().length === 0) fail("Research objective is required");
}

export function validateCurrency(value: string): void {
  if (!currencyCodeSchema.safeParse(value).success) {
    fail("Currency must be exactly three uppercase ASCII letters");
  }
}

/** Evidence sources must be unique, http(s), titled, and well-formed. */
export function validateEvidenceSources(sources: EvidenceSource[]): void {
  const seen = new Set<string>();
  for (const source of sources) {
    if (!evidenceSourceIdSchema.safeParse(source.id).success || seen.has(source.id)) {
      fail("source IDs must be unique and start with S-");
    }
    seen.add(source.id);

    const validUrl = HTTP_PREFIXES.some(
      (prefix) => source.url.startsWith(prefix) && source.url.slice(prefix.length).trim().length > 0,
    );
    if (!validUrl) fail(`${source.id} needs an http or https URL`);
    if (source.title.trim().length === 0) fail(`${source.id} needs a title`);
  }
}

export function validateCompetitors(competitors: Competitor[], projectCurrency: string): void {
  const seen = new Set<string>();
  for (const competitor of competitors) {
    if (!competitorIdSchema.safeParse(competitor.id).success || seen.has(competitor.id)) {
      fail("competitor IDs must be unique and start with C-");
    }
    seen.add(competitor.id);

    if (competitor.product.trim().length === 0 || competitor.currency !== projectCurrency) {
      fail(`${competitor.id} has an invalid product or currency`);
    }
    if (competitor.price !== null && amountOf(competitor.price).isNegative()) {
      fail(`${competitor.id} has a negative price`);
    }
  }
}

export function validateAssumptions(assumptions: CostAssumptions, projectCurrency: string): void {
  if (assumptions.currency !== projectCurrency) {
    fail("Assumptions must use the project schema and currency");
  }

  for (const cost of [assumptions.acquisitionCost, assumptions.shippingCost, assumptions.otherCosts]) {
    if (amountOf(cost).isNegative()) fail("Costs cannot be negative");
  }

  for (const rate of [assumptions.marketplaceFeeRate, assumptions.paymentFeeRate]) {
    const value = amountOf(rate);
    if (value.isNegative() || value.greaterThan(HUNDRED)) {
      fail("Fee rates must be between 0 and 100");
    }
  }

  for (const price of [
    assumptions.scenarioPrices.low,
    assumptions.scenarioPrices.base,
    assumptions.scenarioPrices.high,
  ]) {
    if (price !== null && amountOf(price).lessThanOrEqualTo(ZERO)) {
      fail("Scenario prices must be positive");
    }
  }
}
