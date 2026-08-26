import Decimal from "decimal.js";

/**
 * Exact-decimal money engine.
 *
 * All commerce arithmetic runs here on arbitrary-precision decimals — never
 * binary floats, never an LLM. Amounts cross file and process boundaries as
 * canonical strings with exactly two fractional digits. Rounding is
 * half-away-from-zero, mirroring the legacy Rust engine so golden fixtures
 * stay byte-identical.
 */

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

const AMOUNT_PLACES = 2;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Canonical boundary form: always exactly two fractional digits (e.g. "-0.50"). */
export function formatAmount(value: Decimal): string {
  return value.toFixed(AMOUNT_PLACES);
}

/** Round to two decimal places, ties away from zero. */
export function roundAmount(value: Decimal): Decimal {
  return value.toDecimalPlaces(AMOUNT_PLACES, Decimal.ROUND_HALF_UP);
}

/**
 * Strict parser for user- and file-supplied amounts: at most two fractional
 * digits, no thousands separators, no exponent notation.
 */
export function parseAmount(raw: string): Decimal {
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyError(`Invalid decimal amount: ${JSON.stringify(raw)}`);
  }
  const parsed = new Decimal(raw);
  if (!parsed.isFinite()) {
    throw new MoneyError(`Invalid decimal amount: ${JSON.stringify(raw)}`);
  }
  return parsed;
}
