import type {
  CostAssumptions,
  EconomicsScenario,
  ScenarioName,
} from "@open-merchant/shared";

import { MoneyError, formatAmount, parseAmount, roundAmount } from "./money";

/**
 * Deterministic unit-economics engine. Ported from the legacy Rust
 * `merchant-core::economics` with byte-identical outputs (see golden
 * fixtures): fees enter totals UNROUNDED and every emitted field is rounded
 * independently, half-away-from-zero, to two decimal places.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export const MISSING_SCENARIO_PRICE = "Every selling-price scenario must be provided";
export const SELLING_PRICE_POSITIVE = "Selling prices must be positive";

const SCENARIO_ORDER: readonly (readonly [ScenarioName, keyof CostAssumptions["scenarioPrices"]])[] = [
  ["low", "low"],
  ["base", "base"],
  ["high", "high"],
];

export function calculateScenario(
  scenarioName: ScenarioName,
  sellingPriceRaw: string | null,
  assumptions: CostAssumptions,
): EconomicsScenario {
  if (sellingPriceRaw === null || sellingPriceRaw === undefined) {
    throw new DomainError(MISSING_SCENARIO_PRICE);
  }
  const selling = parseAmount(sellingPriceRaw);
  if (selling.lessThanOrEqualTo(0)) {
    throw new DomainError(SELLING_PRICE_POSITIVE);
  }

  // Full-precision intermediates — rounding happens only at emission.
  const marketplaceFee = selling.times(parseAmount(assumptions.marketplaceFeeRate)).dividedBy(100);
  const paymentFee = selling.times(parseAmount(assumptions.paymentFeeRate)).dividedBy(100);
  const totalCost = parseAmount(assumptions.acquisitionCost)
    .plus(parseAmount(assumptions.shippingCost))
    .plus(marketplaceFee)
    .plus(paymentFee)
    .plus(parseAmount(assumptions.otherCosts));
  const grossProfit = selling.minus(totalCost);
  const grossMarginPercent = grossProfit.dividedBy(selling).times(100);

  return {
    scenario: scenarioName,
    sellingPrice: formatAmount(selling),
    acquisitionCost: formatAmount(parseAmount(assumptions.acquisitionCost)),
    shippingCost: formatAmount(parseAmount(assumptions.shippingCost)),
    marketplaceFeeRate: formatAmount(parseAmount(assumptions.marketplaceFeeRate)),
    marketplaceFee: formatAmount(roundAmount(marketplaceFee)),
    paymentFeeRate: formatAmount(parseAmount(assumptions.paymentFeeRate)),
    paymentFee: formatAmount(roundAmount(paymentFee)),
    otherCosts: formatAmount(parseAmount(assumptions.otherCosts)),
    totalCost: formatAmount(roundAmount(totalCost)),
    grossProfit: formatAmount(roundAmount(grossProfit)),
    grossMarginPercent: formatAmount(roundAmount(grossMarginPercent)),
  };
}

/** Calculates all three scenarios in low/base/high order; all-or-nothing. */
export function calculateScenarios(assumptions: CostAssumptions): EconomicsScenario[] {
  try {
    return SCENARIO_ORDER.map(([name, key]) => calculateScenario(name, assumptions.scenarioPrices[key], assumptions));
  } catch (error) {
    if (error instanceof MoneyError) {
      throw new DomainError(error.message);
    }
    throw error;
  }
}
