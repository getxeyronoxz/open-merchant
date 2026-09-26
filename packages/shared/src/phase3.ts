import { z } from "zod";

import { auditReportSchema, competitorDraftSchema, economicsReviewSchema, researchPlanSchema } from "./ai";
import {
  evidenceSourceSchema,
  isoDateTimeSchema,
  reportSectionsSchema,
} from "./artifacts";
import { currencyCodeSchema } from "./money";
import { artifactFingerprintSchema, generationOriginSchema, sha256Schema } from "./provenance";

/**
 * A user-entered conversion rate. It is deliberately more precise than a
 * money amount: rates are inputs, and converted values are rounded to two
 * places only when written to their destination fields.
 */
export const conversionRateSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,12})?$/u, "Conversion rate must be a positive decimal with at most 12 places");

export const currencyChangePreviewSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  rate: conversionRateSchema,
  createdAt: isoDateTimeSchema,
  affectedArtifacts: z.array(artifactFingerprintSchema).min(1),
  beforeHash: sha256Schema,
  afterHash: sha256Schema,
  sample: z.object({ path: z.string().min(1), before: z.string(), after: z.string() }),
});
export type CurrencyChangePreview = z.infer<typeof currencyChangePreviewSchema>;

export const currencyChangeRecordSchema = z.object({
  runId: z.string().min(1),
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  rate: conversionRateSchema,
  changedAt: isoDateTimeSchema,
  affectedArtifacts: z.array(artifactFingerprintSchema).min(1),
  beforeHash: sha256Schema,
  afterHash: sha256Schema,
  oldValues: z.record(z.string()),
  newValues: z.record(z.string()),
});
export const currencyChangeRecordsSchema = z.object({ changes: z.array(currencyChangeRecordSchema) });
export type CurrencyChangeRecord = z.infer<typeof currencyChangeRecordSchema>;

/** Stable identifiers keep project-local Draft Desk records addressable. */
export const draftIdSchema = z.string().regex(/^DRAFT-[A-Za-z0-9._-]+$/u, "Invalid draft id");

const draftBase = {
  id: draftIdSchema,
  origin: generationOriginSchema,
  createdAt: isoDateTimeSchema,
};

const evidenceDraftSchema = z.object({
  ...draftBase,
  kind: z.literal("evidence"),
  value: evidenceSourceSchema,
});

const competitorsDraftSchema = z.object({
  ...draftBase,
  kind: z.literal("competitors"),
  value: z.array(competitorDraftSchema).min(1),
});

export const draftRecordSchema = z.discriminatedUnion("kind", [
  z.object({ ...draftBase, kind: z.literal("plan"), value: researchPlanSchema }),
  evidenceDraftSchema,
  competitorsDraftSchema,
  z.object({ ...draftBase, kind: z.literal("economics"), value: economicsReviewSchema }),
  z.object({ ...draftBase, kind: z.literal("sections"), value: reportSectionsSchema }),
  z.object({ ...draftBase, kind: z.literal("audit"), value: auditReportSchema }),
  z.object({ ...draftBase, kind: z.literal("currency"), value: currencyChangePreviewSchema }),
]);
export type DraftRecord = z.infer<typeof draftRecordSchema>;
export type DraftKind = DraftRecord["kind"];

/**
 * What a connector is allowed to produce: evidence and competitor drafts, and
 * nothing else. A currency preview is a decision this app makes for the seller,
 * not something a third-party program gets to suggest — so the response type
 * says so, and the renderer never has to imagine a branch it cannot show.
 */
export const connectorDraftSchema = z.discriminatedUnion("kind", [
  evidenceDraftSchema,
  competitorsDraftSchema,
]);
export type ConnectorDraft = z.infer<typeof connectorDraftSchema>;

/** A declarative local plugin. No third-party JavaScript is imported into Electron. */
export const pluginCapabilitySchema = z.object({
  reads: z.array(z.enum(["project", "evidence", "market", "economics", "csv"])),
  writes: z.array(z.enum(["drafts"])),
  network: z.boolean(),
});

const pluginBase = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Plugin ids use lowercase words separated by hyphens"),
  name: z.string().trim().min(1),
  version: z.string().regex(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u, "Plugin version must be semantic"),
  author: z.string().trim().min(1),
  authorUrl: z.string().url().optional(),
  minAppVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u, "minAppVersion must be semantic"),
  capabilities: pluginCapabilitySchema,
};

export const pluginManifestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...pluginBase,
    kind: z.literal("connector"),
    description: z.string().trim().min(1),
    toolName: z.string().regex(/^[a-z0-9_-]+$/u),
    command: z.string().trim().min(1),
    args: z.array(z.string()),
  }),
  z.object({
    ...pluginBase,
    kind: z.literal("csv-importer"),
    description: z.string().trim().min(1),
    mapping: z.record(z.string().min(1)),
  }),
  z.object({
    ...pluginBase,
    kind: z.literal("report-section"),
    description: z.string().trim().min(1),
    section: z.enum(["decisionSummary", "marketObservations", "risks", "opportunities"]),
    markdown: z.string().trim().min(1),
  }),
]);

export const installedPluginSchema = z.object({
  manifest: pluginManifestSchema,
  directory: z.string().min(1),
  enabled: z.boolean(),
  enabledAt: isoDateTimeSchema.nullable(),
});
export const brokenPluginSchema = z.object({
  directoryName: z.string().min(1),
  reason: z.string().min(1),
});
export const pluginCatalogSchema = z.object({
  plugins: z.array(installedPluginSchema),
  broken: z.array(brokenPluginSchema),
});
export type BrokenPlugin = z.infer<typeof brokenPluginSchema>;
export type PluginCatalog = z.infer<typeof pluginCatalogSchema>;
export type PluginCapabilities = z.infer<typeof pluginCapabilitySchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type InstalledPlugin = z.infer<typeof installedPluginSchema>;

/** One locally persisted snooze/dismissal. It never contacts a service. */
export const reviewDispositionSchema = z.object({
  reviewKey: z.string().regex(/^[a-z0-9]+:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/u),
  action: z.enum(["snoozed", "dismissed"]),
  until: isoDateTimeSchema.nullable(),
  recordedAt: isoDateTimeSchema,
});
export const reviewDispositionsSchema = z.object({ dispositions: z.array(reviewDispositionSchema) });
export type ReviewDisposition = z.infer<typeof reviewDispositionSchema>;

export const standingReviewSchema = z.object({
  key: reviewDispositionSchema.shape.reviewKey,
  kind: z.enum(["unchecked-decision", "stale-evidence", "margin-watch", "margin-breach"]),
  title: z.string().min(1),
  detail: z.string(),
  dueAt: isoDateTimeSchema,
  severity: z.enum(["info", "warning", "critical"]),
  projectRoot: z.string().min(1),
  projectName: z.string().min(1),
});
export const standingReviewsSchema = z.object({ reviews: z.array(standingReviewSchema) });
export type StandingReview = z.infer<typeof standingReviewSchema>;

export const connectorResultSchema = z.object({
  evidence: z.array(evidenceSourceSchema).default([]),
  competitors: z.array(competitorDraftSchema).default([]),
});
export type ConnectorResult = z.infer<typeof connectorResultSchema>;

export const draftInboxSchema = z.object({ drafts: z.array(draftRecordSchema) });
export type DraftInbox = z.infer<typeof draftInboxSchema>;

