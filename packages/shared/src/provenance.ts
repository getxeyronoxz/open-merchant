import { z } from "zod";

import { isoDateTimeSchema } from "./artifacts";
import { currencyCodeSchema } from "./money";

/** Provenance and run history. Every generated artifact links to its run. */
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 hex digest");

export const artifactFingerprintSchema = z.object({
  path: z.string(),
  sha256: sha256Schema,
});

export const aiOriginSchema = z.object({
  kind: z.literal("agent"),
  agentId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  promptHash: sha256Schema,
});

export const userOriginSchema = z.object({ kind: z.literal("user") });

export const connectorOriginSchema = z.object({
  kind: z.literal("connector"),
  connectorId: z.string().min(1),
  pluginId: z.string().min(1),
  fetchedAt: isoDateTimeSchema,
  rawResponseHash: sha256Schema,
});

export const generationOriginSchema = z.discriminatedUnion("kind", [
  userOriginSchema,
  aiOriginSchema,
  connectorOriginSchema,
]);

export const provenanceRecordSchema = z.object({
  runId: z.string(),
  artifactPath: z.string(),
  sha256: sha256Schema,
  generatedAt: isoDateTimeSchema,
  origin: generationOriginSchema,
});

export const runOperationSchema = z.enum([
  "projectCreated",
  "projectImported",
  "economicsGenerated",
  "reportGenerated",
  "agentDraftProduced",
  "artifactSaved",
  "snapshotCaptured",
  "mcpArtifactRead",
  "connectorFetched",
  "draftDiscarded",
  "reviewSnoozed",
  "reviewDismissed",
  "pluginEnabled",
  "pluginDisabled",
  "currencyChanged",
]);

export const runStatusSchema = z.enum(["succeeded", "failed"]);

/**
 * A review key names one nag inside one project: `<kind>:<subject>`, e.g.
 * `stale-evidence:S-001` or `margin-watch:base`.
 *
 * The kind segment is lowercase and dashed so the four review kinds can be
 * written verbatim; it still admits no `:`, no `/`, no `\`, and no uppercase
 * start, so a key can never express a filesystem path. The subject segment
 * carries the evidence id or scenario name the core already generates.
 */
export const reviewKeyShape = z
  .string()
  .regex(/^[a-z][a-z0-9-]*:[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/u);

/**
 * One locally persisted snooze/dismissal. It never contacts a service.
 *
 * `reviewDueAt` records *which occurrence* was silenced, not just what kind of
 * review it was. Without it a dismissal would be permanent: the seller silences
 * stale evidence, refreshes it, and it goes stale again next year — and the
 * old dismissal would still be hiding it. Matching on the occurrence means a
 * disposition dies with the thing it silenced, so a genuinely new occurrence is
 * new information and is surfaced.
 */
export const reviewDispositionSchema = z.object({
  reviewKey: reviewKeyShape,
  action: z.enum(["snoozed", "dismissed"]),
  reviewDueAt: isoDateTimeSchema,
  until: isoDateTimeSchema.nullable(),
  recordedAt: isoDateTimeSchema,
});
export const reviewDispositionsSchema = z.object({ dispositions: z.array(reviewDispositionSchema) });
export type ReviewDisposition = z.infer<typeof reviewDispositionSchema>;

const REVIEW_OPERATIONS = { reviewSnoozed: "snoozed", reviewDismissed: "dismissed" } as const;

/**
 * A user-entered conversion rate. It is deliberately more precise than a money
 * amount: rates are inputs, and converted values are rounded to two places only
 * when written to their destination fields.
 *
 * Zero is not a rate. A rate of zero would restate every amount in a project
 * as `0.00` with no way back, so the shape rejects it outright rather than
 * leaving the domain to notice.
 */
export const conversionRateSchema = z
  .string()
  .regex(
    /^(?:0\.(?:0*[1-9]\d{0,11})|[1-9]\d*(?:\.\d{1,12})?)$/u,
    "Conversion rate must be a positive decimal with at most 12 places",
  );

/**
 * Every money value that moved, keyed `<artifact path>#<json path>`. Held as
 * flat string maps rather than a nested structure because the journal only ever
 * reads them back to show what a change did — and because a nested value would
 * lose the two-place canonical form the money engine guarantees.
 */
const valueMapSchema = z.record(z.string());

export const currencyChangePreviewSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: conversionRateSchema,
    createdAt: isoDateTimeSchema,
    affectedArtifacts: z.array(artifactFingerprintSchema).min(1),
    beforeHash: sha256Schema,
    afterHash: sha256Schema,
    oldValues: valueMapSchema,
    newValues: valueMapSchema,
    changedCount: z.number().int().nonnegative(),
  })
  // A count that disagrees with the maps it summarises is a preview the UI
  // would render as "12 values change" over two rows.
  .refine((preview) => Object.keys(preview.newValues).length === preview.changedCount, {
    path: ["changedCount"],
    message: "changedCount must match the number of converted values",
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
  oldValues: valueMapSchema,
  newValues: valueMapSchema,
});
export const currencyChangeRecordsSchema = z.object({ changes: z.array(currencyChangeRecordSchema) });
export type CurrencyChangeRecord = z.infer<typeof currencyChangeRecordSchema>;

/**
 * A run may carry the payload that caused it, and only then. Each payload is
 * required exactly on the operations that produce it and forbidden everywhere
 * else, so the journal can never claim a snooze or a currency change that did
 * not happen, nor attach one to an unrelated run. Each is a typed field rather
 * than a string smuggled into `inputArtifacts`, which means "a real file was
 * read" and would put a lie in the project's record.
 */
export const runRecordSchema = z
  .object({
    runId: z.string(),
    operation: runOperationSchema,
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema,
    status: runStatusSchema,
    appVersion: z.string(),
    inputArtifacts: z.array(artifactFingerprintSchema),
    outputArtifacts: z.array(artifactFingerprintSchema),
    errorSummary: z.string().nullable(),
    review: reviewDispositionSchema.optional(),
    currencyChange: currencyChangeRecordSchema.optional(),
  })
  .superRefine((record, ctx) => {
    const expected = REVIEW_OPERATIONS[record.operation as keyof typeof REVIEW_OPERATIONS];
    if (expected === undefined) {
      if (record.review !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["review"],
          message: `A ${record.operation} run cannot carry a review disposition.`,
        });
      }
    } else if (record.review === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["review"],
        message: `A ${record.operation} run must carry the disposition it recorded.`,
      });
    } else if (record.review.action !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["review", "action"],
        message: `A ${record.operation} run cannot record a "${record.review.action}" disposition.`,
      });
    }

    // A run that failed has no change to describe: the payload is required on
    // a currency change that landed, forbidden everywhere else. Requiring it on
    // a failure would make the journal unable to record the attempt at all.
    const landedCurrencyChange = record.operation === "currencyChanged" && record.status === "succeeded";
    if (landedCurrencyChange && record.currencyChange === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["currencyChange"],
        message: "A currencyChanged run must carry the change it made.",
      });
    }
    if (!landedCurrencyChange && record.currencyChange !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["currencyChange"],
        message: `A ${record.operation} run cannot carry a currency change.`,
      });
    }
  });

export type ArtifactFingerprint = z.infer<typeof artifactFingerprintSchema>;
export type AiOrigin = z.infer<typeof aiOriginSchema>;
export type ConnectorOrigin = z.infer<typeof connectorOriginSchema>;
export type GenerationOrigin = z.infer<typeof generationOriginSchema>;
export type ProvenanceRecord = z.infer<typeof provenanceRecordSchema>;
export type RunOperation = z.infer<typeof runOperationSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
