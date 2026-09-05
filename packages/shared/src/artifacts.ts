import { z } from "zod";

import {
  competitorIdSchema,
  currencyCodeSchema,
  evidenceSourceIdSchema,
  marketSnapshotIdSchema,
  moneyStringSchema,
} from "./money";

/**
 * Workspace format v2. A project is an ordinary folder owned by the user;
 * these schemas describe every known artifact inside it. Malformed data is
 * rejected loudly at this boundary — never silently repaired.
 */

export const isoDateTimeSchema = z.string().datetime({ offset: true });

const trimmedNonEmpty = (label: string) =>
  z
    .string()
    .refine((value) => value.trim().length > 0, `${label} is required`);

export const SCHEMA_VERSION = 2;

export const manifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: z.string().uuid(),
  name: trimmedNonEmpty("Project name"),
  objective: trimmedNonEmpty("Research objective"),
  currency: currencyCodeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const observationSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  note: z.string(),
});

export const evidenceSourceSchema = z.object({
  id: evidenceSourceIdSchema,
  url: z
    .string()
    .url()
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "Evidence URLs must be http or https",
    }),
  title: trimmedNonEmpty("Source title"),
  notes: z.string(),
  observations: z.array(observationSchema),
  observedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const competitorSchema = z.object({
  id: competitorIdSchema,
  product: trimmedNonEmpty("Product"),
  brand: z.string(),
  price: moneyStringSchema.nullable(),
  currency: currencyCodeSchema,
  marketplace: z.string(),
  url: z.string(),
  sourceId: evidenceSourceIdSchema.nullable(),
  notes: z.string(),
  observedAt: isoDateTimeSchema,
});

export const scenarioPricesSchema = z.object({
  low: moneyStringSchema.nullable(),
  base: moneyStringSchema.nullable(),
  high: moneyStringSchema.nullable(),
});

export const costAssumptionsSchema = z.object({
  currency: currencyCodeSchema,
  acquisitionCost: moneyStringSchema,
  shippingCost: moneyStringSchema,
  marketplaceFeeRate: moneyStringSchema,
  paymentFeeRate: moneyStringSchema,
  otherCosts: moneyStringSchema,
  scenarioPrices: scenarioPricesSchema,
});

export const scenarioNameSchema = z.enum(["low", "base", "high"]);

export const economicsScenarioSchema = z.object({
  scenario: scenarioNameSchema,
  sellingPrice: moneyStringSchema,
  acquisitionCost: moneyStringSchema,
  shippingCost: moneyStringSchema,
  marketplaceFeeRate: moneyStringSchema,
  marketplaceFee: moneyStringSchema,
  paymentFeeRate: moneyStringSchema,
  paymentFee: moneyStringSchema,
  otherCosts: moneyStringSchema,
  totalCost: moneyStringSchema,
  grossProfit: moneyStringSchema,
  grossMarginPercent: moneyStringSchema,
});

export const reportSectionsSchema = z.object({
  decisionSummary: z.string(),
  marketObservations: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
});

export const competitorStatisticsSchema = z.object({
  validPriceCount: z.number().int().nonnegative(),
  minimum: moneyStringSchema.nullable(),
  maximum: moneyStringSchema.nullable(),
  average: moneyStringSchema.nullable(),
  median: moneyStringSchema.nullable(),
});

/**
 * Market snapshots (phase 2): an immutable, timestamped capture of the whole
 * competitor listing set. Snapshots are never edited — new ones accumulate,
 * and price history is derived from the sequence.
 */
export const marketSnapshotSchema = z.object({
  id: marketSnapshotIdSchema,
  capturedAt: isoDateTimeSchema,
  note: z.string(),
  listingCount: z.number().int().nonnegative(),
  statistics: competitorStatisticsSchema,
  listings: z.array(competitorSchema),
});

export const snapshotPriceChangeSchema = z.object({
  key: z.string(),
  product: z.string(),
  brand: z.string(),
  marketplace: z.string(),
  fromPrice: moneyStringSchema.nullable(),
  toPrice: moneyStringSchema.nullable(),
});

export const snapshotDiffSchema = z.object({
  fromId: marketSnapshotIdSchema,
  toId: marketSnapshotIdSchema,
  added: z.array(competitorSchema),
  removed: z.array(competitorSchema),
  priceChanges: z.array(snapshotPriceChangeSchema),
});

export const listingPricePointSchema = z.object({
  snapshotId: marketSnapshotIdSchema,
  capturedAt: isoDateTimeSchema,
  price: moneyStringSchema.nullable(),
});

export const listingPriceHistorySchema = z.object({
  key: z.string(),
  product: z.string(),
  brand: z.string(),
  marketplace: z.string(),
  points: z.array(listingPricePointSchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type Competitor = z.infer<typeof competitorSchema>;
export type ScenarioPrices = z.infer<typeof scenarioPricesSchema>;
export type CostAssumptions = z.infer<typeof costAssumptionsSchema>;
export type ScenarioName = z.infer<typeof scenarioNameSchema>;
export type EconomicsScenario = z.infer<typeof economicsScenarioSchema>;
export type CompetitorStatistics = z.infer<typeof competitorStatisticsSchema>;
export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;
export type SnapshotPriceChange = z.infer<typeof snapshotPriceChangeSchema>;
export type SnapshotDiff = z.infer<typeof snapshotDiffSchema>;
export type ListingPricePoint = z.infer<typeof listingPricePointSchema>;
export type ListingPriceHistory = z.infer<typeof listingPriceHistorySchema>;
export type ReportSections = z.infer<typeof reportSectionsSchema>;

export function emptyReportSections(): ReportSections {
  return { decisionSummary: "", marketObservations: [], risks: [], opportunities: [] };
}
