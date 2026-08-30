import { z } from "zod";

import {
  competitorSchema,
  competitorStatisticsSchema,
  costAssumptionsSchema,
  economicsScenarioSchema,
  evidenceSourceSchema,
  isoDateTimeSchema,
  manifestSchema,
  reportSectionsSchema,
} from "./artifacts";
import {
  auditReportSchema,
  competitorDraftSchema,
  economicsReviewSchema,
  providerIdSchema,
  researchPlanSchema,
} from "./ai";
import { aiOriginSchema, generationOriginSchema, provenanceRecordSchema, runRecordSchema } from "./provenance";

/**
 * The IPC contract between renderer and main process. This map is the single
 * source of truth: the SDK types itself against it, the preload bridge
 * allows exactly these channels, and main-process handlers validate payloads
 * with the same schemas. Adding a capability means adding an entry here.
 */

export const projectSnapshotSchema = z.object({
  root: z.string(),
  manifest: manifestSchema,
});

export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

export const recentProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  lastOpenedAt: isoDateTimeSchema,
});

export type RecentProject = z.infer<typeof recentProjectSchema>;

export const createProjectInputSchema = z.object({
  parentDirectory: z.string(),
  name: z.string(),
  objective: z.string(),
  currency: z.string(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const openProjectInputSchema = z.object({ root: z.string() });
export const rootOnlyInputSchema = z.object({ root: z.string() });

/**
 * Walking-skeleton contract (phase 0): application identity plus the two
 * project primitives needed by a stub Home screen. Later phases extend this
 * map — evidence, competitors, economics, report, artifacts, AI.
 */
export const ipc = {
  "app/info": {
    request: z.object({}),
    response: z.object({
      appName: z.string(),
      appVersion: z.string(),
      platform: z.string(),
    }),
  },
  "dialog/choose-directory": {
    request: z.object({ title: z.string() }),
    response: z.object({ path: z.string().nullable() }),
  },
  "project/create": {
    request: createProjectInputSchema,
    response: z.object({
      snapshot: projectSnapshotSchema,
    }),
  },
  "project/open": {
    request: openProjectInputSchema,
    response: z.object({
      snapshot: projectSnapshotSchema,
    }),
  },
  "manifest/save": {
    request: z.object({ root: z.string(), manifest: manifestSchema }),
    response: z.object({
      snapshot: projectSnapshotSchema,
    }),
  },
  "project/import-v0": {
    request: z.object({
      v0Root: z.string(),
      parentDirectory: z.string(),
    }),
    response: z.object({
      snapshot: projectSnapshotSchema,
      importedEvidence: z.number().int(),
      importedCompetitors: z.number().int(),
    }),
  },
  "recents/list": {
    request: z.object({}),
    response: z.object({ projects: z.array(recentProjectSchema) }),
  },
  "recents/remove": {
    request: z.object({ path: z.string() }),
    response: z.object({}),
  },

  "evidence/load": {
    request: rootOnlyInputSchema,
    response: z.object({ sources: z.array(evidenceSourceSchema) }),
  },
  "evidence/save": {
    request: z.object({
      root: z.string(),
      sources: z.array(evidenceSourceSchema),
      // Set when the saved content originated from an accepted AI draft.
      origin: generationOriginSchema.optional(),
    }),
    response: z.object({}),
  },

  "competitors/load": {
    request: rootOnlyInputSchema,
    response: z.object({ competitors: z.array(competitorSchema) }),
  },
  "competitors/save": {
    request: z.object({ root: z.string(), competitors: z.array(competitorSchema) }),
    response: z.object({}),
  },
  "competitors/statistics": {
    request: rootOnlyInputSchema,
    response: z.object({ statistics: competitorStatisticsSchema }),
  },

  "assumptions/load": {
    request: rootOnlyInputSchema,
    response: z.object({ assumptions: costAssumptionsSchema }),
  },
  "assumptions/save": {
    request: z.object({ root: z.string(), assumptions: costAssumptionsSchema }),
    response: z.object({}),
  },
  "economics/calculate": {
    request: rootOnlyInputSchema,
    response: z.object({ scenarios: z.array(economicsScenarioSchema) }),
  },
  "scenarios/load": {
    request: rootOnlyInputSchema,
    response: z.object({ scenarios: z.array(economicsScenarioSchema) }),
  },

  "report/sections/load": {
    request: rootOnlyInputSchema,
    response: z.object({ sections: reportSectionsSchema }),
  },
  "report/sections/save": {
    request: z.object({
      root: z.string(),
      sections: reportSectionsSchema,
      origin: generationOriginSchema.optional(),
    }),
    response: z.object({}),
  },
  "report/generate": {
    request: rootOnlyInputSchema,
    response: z.object({ markdown: z.string() }),
  },
  "report/load-generated": {
    request: rootOnlyInputSchema,
    response: z.object({ markdown: z.string().nullable() }),
  },

  "artifacts/list": {
    request: rootOnlyInputSchema,
    response: z.object({
      artifacts: z.array(z.object({ path: z.string(), exists: z.boolean() })),
    }),
  },
  "artifacts/read": {
    request: z.object({ root: z.string(), relativePath: z.string() }),
    response: z.object({ text: z.string() }),
  },
  "runs/list": {
    request: rootOnlyInputSchema,
    response: z.object({ runs: z.array(runRecordSchema) }),
  },
  "provenance/list": {
    request: rootOnlyInputSchema,
    response: z.object({ provenance: z.array(provenanceRecordSchema) }),
  },
  "history/read": {
    request: z.object({
      root: z.string(),
      kind: z.enum(["scenarios", "report"]),
      runId: z.string().min(1),
    }),
    response: z.object({ text: z.string().nullable() }),
  },

  // --- AI copilot -----------------------------------------------------------

  "ai/config/load": {
    request: z.object({}),
    response: z.object({
      activeProvider: z.string().nullable(),
      models: z.record(z.string()),
      hasKeys: z.record(z.boolean()),
      baseUrls: z.record(z.string()),
      encryptionAvailable: z.boolean(),
    }),
  },
  "ai/config/save": {
    request: z.object({
      providerId: providerIdSchema,
      modelId: z.string().min(1),
      apiKey: z.string().min(1).nullable(),
      /** Local endpoints (Ollama, LM Studio) need an OpenAI-compatible base URL. */
      baseUrl: z.string().url().nullable().optional(),
    }),
    response: z.object({}),
  },
  "ai/test": {
    request: z.object({ providerId: providerIdSchema }),
    response: z.object({ reply: z.string() }),
  },
  "ai/draft-evidence": {
    request: rootOnlyInputSchema.extend({
      url: z.string().url(),
      pageText: z.string().min(1),
    }),
    response: z.object({
      draft: evidenceSourceSchema,
      origin: aiOriginSchema,
    }),
  },
  "ai/draft-sections": {
    request: rootOnlyInputSchema,
    response: z.object({
      sections: reportSectionsSchema,
      origin: aiOriginSchema,
    }),
  },
  "ai/draft-plan": {
    request: rootOnlyInputSchema,
    response: z.object({ plan: researchPlanSchema, origin: aiOriginSchema }),
  },
  "ai/draft-competitors": {
    request: z.object({ root: z.string(), pastedListings: z.string().min(1) }),
    response: z.object({ competitors: z.array(competitorDraftSchema), origin: aiOriginSchema }),
  },
  "ai/review-economics": {
    request: rootOnlyInputSchema,
    response: z.object({ review: economicsReviewSchema, origin: aiOriginSchema }),
  },
  "ai/audit-report": {
    request: rootOnlyInputSchema,
    response: z.object({ audit: auditReportSchema, origin: aiOriginSchema }),
  },
} as const;

export type IpcContract = typeof ipc;
export type IpcChannel = keyof IpcContract & string;

export type IpcRequest<C extends IpcChannel> = z.infer<IpcContract[C]["request"]>;
export type IpcResponse<C extends IpcChannel> = z.infer<IpcContract[C]["response"]>;

/** Wire format for any rejected command. Successes carry the raw response. */
export const ipcEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string(), detail: z.string().optional() }) }),
]);

export type IpcEnvelope = z.infer<typeof ipcEnvelopeSchema>;
