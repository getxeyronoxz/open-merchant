import type { Competitor, CompetitorStatistics } from "@open-merchant/shared";

import { Decimal, formatAmount, parseAmount, roundAmount } from "./money";

/**
 * Competitor price statistics, ported from the legacy Rust engine:
 * unpriced listings are ignored; min/max come from the sorted valid
 * prices; average and median are rounded half-away-from-zero at emission.
 */

const EMPTY: CompetitorStatistics = {
  validPriceCount: 0,
  minimum: null,
  maximum: null,
  average: null,
  median: null,
};

export function competitorStatistics(competitors: Competitor[]): CompetitorStatistics {
  const prices = competitors
    .map((competitor) => competitor.price)
    .filter((price): price is NonNullable<typeof price> => price !== null)
    .map((price) => parseAmount(price))
    .sort((a, b) => a.comparedTo(b));

  if (prices.length === 0) {
    return EMPTY;
  }

  const count = prices.length;
  const total = prices.reduce((sum, price) => sum.plus(price), new Decimal(0));
  const average = roundAmount(total.dividedBy(count));

  let median: Decimal;
  if (count % 2 === 1) {
    median = prices[(count - 1) / 2] as Decimal;
  } else {
    // Indexing is safe: count is even and at least 2 here.
    const lower = prices[count / 2 - 1] as Decimal;
    const upper = prices[count / 2] as Decimal;
    median = roundAmount(lower.plus(upper).dividedBy(2));
  }

  return {
    validPriceCount: count,
    minimum: formatAmount(prices[0] as Decimal),
    maximum: formatAmount(prices[count - 1] as Decimal),
    average: formatAmount(average),
    median: formatAmount(median),
  };
}
