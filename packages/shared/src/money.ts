import { z } from "zod";

/**
 * Decimal money strings are the only way monetary values cross process or
 * file boundaries. Binary floating point is never used for commerce math.
 *
 * Parse-level schema: accepts what a user or an older file may contain
 * (optional minus sign, zero-to-two fractional digits). Canonical file
 * format — exactly two fractional digits — is produced by the domain
 * engine's money module and asserted by golden tests.
 */
export const moneyStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Expected a decimal amount with at most two fractional digits");

/** ISO-4217-style currency code as used across the workspace: exactly three uppercase letters. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be exactly three uppercase ASCII letters");

export const evidenceSourceIdSchema = z
  .string()
  .regex(/^S-\d{3,}$/, "Evidence source IDs look like S-001");
export const competitorIdSchema = z
  .string()
  .regex(/^C-\d{3,}$/, "Competitor IDs look like C-001");
export const marketSnapshotIdSchema = z
  .string()
  .regex(/^SNAP-\d{8}T\d{6}Z-[0-9a-f]{4}$/, "Market snapshot IDs look like SNAP-20260905T081234Z-4f2a");

export type MoneyString = z.infer<typeof moneyStringSchema>;
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
