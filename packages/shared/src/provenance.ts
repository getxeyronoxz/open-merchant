import { z } from "zod";

import { isoDateTimeSchema } from "./artifacts";

/**
 * Provenance and run history. Every generated artifact is linked to the run
 * that produced it; AI-produced drafts additionally record which agent,
 * provider, and model generated them so any output can be audited back to
 * its origin. Records are append-only.
 */

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

export const generationOriginSchema = z.discriminatedUnion("kind", [
  userOriginSchema,
  aiOriginSchema,
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
]);

export const runStatusSchema = z.enum(["succeeded", "failed"]);

export const runRecordSchema = z.object({
  runId: z.string(),
  operation: runOperationSchema,
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema,
  status: runStatusSchema,
  appVersion: z.string(),
  inputArtifacts: z.array(artifactFingerprintSchema),
  outputArtifacts: z.array(artifactFingerprintSchema),
  errorSummary: z.string().nullable(),
});

export type ArtifactFingerprint = z.infer<typeof artifactFingerprintSchema>;
export type AiOrigin = z.infer<typeof aiOriginSchema>;
export type GenerationOrigin = z.infer<typeof generationOriginSchema>;
export type ProvenanceRecord = z.infer<typeof provenanceRecordSchema>;
export type RunOperation = z.infer<typeof runOperationSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
