import type {
  CostAssumptions,
  EconomicsScenario,
  MarginFlag,
  MarginMonitorResult,
} from "@open-merchant/shared";

import { calculateScenario, DomainError } from "./economics";
import { MoneyError, parseAmount, roundAmount, formatAmount } from "./money";

/**
 * Margin monitor (phase 2): deterministic drift detection. Each scenario's
 * margin is compared against the margin the seller would earn at the market
 * reference price (the median of the latest snapshot). A threshold below
 * which the market margin breaches is stored on the assumptions; statuses:
 * breached (< threshold), watch (< threshold + 5 points), healthy, or
 * unmonitored when no threshold or no market price exists yet.
 */

const WATCH_BUFFER_POINTS = 5;

/** Worst status across monitor flags; "none" when there is nothing to flag. */
export function worstFlagStatus(
  flags: readonly Pick<MarginFlag, "scenario" | "status">[],
): "healthy" | "watch" | "breached" | "none" {
  if (flags.length === 0) return "none";
  if (flags.some((flag) => flag.status === "breached")) return "breached";
  if (flags.some((flag) => flag.status === "watch")) return "watch";
  return "healthy";
}

export function marginMonitor(
  assumptions: CostAssumptions,
  scenarios: EconomicsScenario[],
  marketPrice: string | null,
  marketSource: string | null,
): MarginMonitorResult {
  const thresholdPercent = assumptions.marginThresholdPercent ?? null;
  const threshold = thresholdPercent === null ? null : parseAmount(thresholdPercent);

  const flags: MarginFlag[] = scenarios.map((scenario) => {
    const current = parseAmount(scenario.grossMarginPercent);
    let marginAtMarket: ReturnType<typeof roundAmount> | null = null;
    if (marketPrice !== null) {
      try {
        const atMarket = calculateScenario(scenario.scenario, marketPrice, assumptions);
        marginAtMarket = roundAmount(parseAmount(atMarket.grossMarginPercent));
      } catch (error) {
        if (!(error instanceof DomainError) && !(error instanceof MoneyError)) throw error;
        // A market price that cannot price a scenario (≤ 0, malformed costs)
        // leaves this flag unmonitored rather than failing the whole monitor.
      }
    }

    const drift =
      marginAtMarket === null ? null : formatAmount(roundAmount(marginAtMarket.minus(current)));

    let status: MarginFlag["status"] = "unmonitored";
    if (threshold !== null && marginAtMarket !== null) {
      if (marginAtMarket.lessThan(threshold)) {
        status = "breached";
      } else if (marginAtMarket.lessThan(threshold.plus(WATCH_BUFFER_POINTS))) {
        status = "watch";
      } else {
        status = "healthy";
      }
    }

    return {
      scenario: scenario.scenario,
      sellingPrice: scenario.sellingPrice,
      grossMarginPercent: scenario.grossMarginPercent,
      marginAtMarketPrice: marginAtMarket === null ? null : formatAmount(marginAtMarket),
      driftPercent: drift,
      status,
    };
  });

  return { thresholdPercent, marketPrice, marketSource, flags };
}