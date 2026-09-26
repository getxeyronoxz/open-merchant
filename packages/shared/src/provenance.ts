import { z } from "zod";

import { isoDateTimeSchema } from "./artifacts";

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
 * A run may carry the disposition that caused it, and only then. The payload is
 * required exactly on the two review operations and forbidden everywhere else,
 * so the journal can never claim a snooze that did not happen or attach one to
 * an unrelated run. It is a typed field rather than a string smuggled into
 * `inputArtifacts`, which means "a real file was read" and would put a lie in
 * the project's record.
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
      return;
    }
    if (record.review === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["review"],
        message: `A ${record.operation} run must carry the disposition it recorded.`,
      });
      return;
    }
    if (record.review.action !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["review", "action"],
        message: `A ${record.operation} run cannot record a "${record.review.action}" disposition.`,
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
