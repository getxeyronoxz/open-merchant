import { z } from "zod";

import {
  competitorSchema,
  competitorStatisticsSchema,
  costAssumptionsSchema,
  economicsScenarioSchema,
  evidenceSourceSchema,
  isoDateTimeSchema,
  listingPriceHistorySchema,
  manifestSchema,
  decisionJournalSchema,
  marginMonitorSchema,
  portfolioEntrySchema,
  marketSnapshotSchema,
  reportSectionsSchema,
  snapshotDiffSchema,
} from "./artifacts";
import { currencyCodeSchema, marketSnapshotIdSchema } from "./money";
import {
  auditReportSchema,
  competitorDraftSchema,
  economicsReviewSchema,
  providerIdSchema,
  researchPlanSchema,
} from "./ai";
import {
  aiOriginSchema,
  conversionRateSchema,
  currencyChangePreviewSchema,
  currencyChangeRecordSchema,
  generationOriginSchema,
  provenanceRecordSchema,
  reviewDispositionSchema,
  reviewKeyShape,
  runRecordSchema,
} from "./provenance";
import {
  connectorDraftSchema,
  installedPluginSchema,
  pluginCatalogSchema,
  standingReviewsSchema,
} from "./phase3";

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
 * Pushed from main to the renderer on the one-way "update:status" channel
 * (see the preload bridge). The renderer shows a non-blocking banner when a
 * downloaded update is ready; it never needs to poll.
 */
export const updateStatusSchema = z.object({
  state: z.enum(["checking", "available", "not-available", "downloaded", "error"]),
  version: z.string().optional(),
});

export type UpdateStatus = z.infer<typeof updateStatusSchema>;

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
  "update/install": {
    request: z.object({}),
    response: z.object({ quitting: z.boolean() }),
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
    request: z.object({
      root: z.string(),
      competitors: z.array(competitorSchema),
      // Set when the saved content originated from an accepted AI draft.
      origin: generationOriginSchema.optional(),
    }),
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

  // --- market snapshots (phase 2) -------------------------------------------

  "snapshots/capture": {
    request: z.object({ root: z.string(), note: z.string() }),
    response: z.object({ snapshot: marketSnapshotSchema }),
  },
  "snapshots/list": {
    request: rootOnlyInputSchema,
    response: z.object({ snapshots: z.array(marketSnapshotSchema) }),
  },
  "snapshots/diff": {
    request: z.object({
      root: z.string(),
      fromId: marketSnapshotIdSchema,
      toId: marketSnapshotIdSchema,
    }),
    response: z.object({ diff: snapshotDiffSchema }),
  },
  "snapshots/history": {
    request: rootOnlyInputSchema,
    response: z.object({ history: z.array(listingPriceHistorySchema) }),
  },
  "monitor/margin": {
    request: rootOnlyInputSchema,
    response: z.object({ monitor: marginMonitorSchema }),
  },
  "journal/decision": {
    request: rootOnlyInputSchema,
    response: z.object({ journal: decisionJournalSchema }),
  },
  "portfolio/overview": {
    request: z.object({}),
    response: z.object({ projects: z.array(portfolioEntrySchema) }),
  },

  // --- file-first pillar (phase 2) -------------------------------------------

  "csv/export": {
    request: z.object({ root: z.string(), kind: z.enum(["competitors", "evidence", "scenarios"]) }),
    response: z.object({ csv: z.string(), filename: z.string() }),
  },
  "csv/parse": {
    request: z.object({ csv: z.string().min(1) }),
    response: z.object({ headers: z.array(z.string()), rowCount: z.number().int().nonnegative() }),
  },
  "csv/import": {
    request: z.object({
      root: z.string(),
      csv: z.string().min(1),
      mapping: z.record(z.string()).optional(),
    }),
    response: z.object({
      imported: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
    }),
  },
  "archive/create": {
    request: rootOnlyInputSchema,
    response: z.object({ archiveBase64: z.string(), filename: z.string() }),
  },
  "archive/restore": {
    request: z.object({ parentDirectory: z.string(), archiveBase64: z.string().min(1) }),
    response: z.object({ snapshot: projectSnapshotSchema }),
  },
  "report/export-pdf": {
    request: rootOnlyInputSchema,
    response: z.object({ saved: z.boolean(), path: z.string().nullable() }),
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
  "plugins/list": {
    request: z.object({}),
    response: pluginCatalogSchema,
  },
  "plugins/source": {
    request: z.object({ pluginId: z.string().min(1) }),
    response: z.object({ source: z.string() }),
  },
  "plugins/set-enabled": {
    request: z.object({ pluginId: z.string().min(1), enabled: z.boolean() }),
    response: z.object({ plugin: installedPluginSchema }),
  },
  "connectors/fetch": {
    request: z.object({ root: z.string(), pluginId: z.string().min(1), query: z.string().min(1) }),
    response: z.object({ drafts: z.array(connectorDraftSchema).min(1), fetchedAt: isoDateTimeSchema }),
  },

  // --- standing reviews (phase 3) -------------------------------------------

  /**
   * The attention queue across every project the app knows about. `now` is
   * read in the main process, not sent: the renderer cannot be trusted to
   * decide what "stale" means, and a review that disagreed with the clock that
   * produced it would be worse than none.
   */
  "reviews/standing": {
    request: z.object({}),
    response: standingReviewsSchema,
  },
  /**
   * Snooze or dismiss one review. The request names only the key; the main
   * process looks the review up and records *its* due date as the occurrence
   * being silenced, so the renderer cannot silence a different one by
   * asserting a date.
   */
  "reviews/dispose": {
    request: z.object({ root: z.string(), reviewKey: reviewKeyShape, action: z.enum(["snoozed", "dismissed"]) }),
    response: z.object({ disposition: reviewDispositionSchema }),
  },
  /**
   * Restate a project in another currency, at a rate the seller types. There is
   * no network call behind this channel: the rate is an input, never a lookup.
   *
   * Both channels take only the seller's intent. The main process derives the
   * change from the artifacts on disk and the renderer never supplies a plan,
   * so a stale or hand-built preview cannot decide what gets written.
   */
  "currency/preview": {
    request: z.object({ root: z.string(), toCurrency: currencyCodeSchema, rate: conversionRateSchema }),
    response: currencyChangePreviewSchema,
  },
  "currency/apply": {
    request: z.object({ root: z.string(), toCurrency: currencyCodeSchema, rate: conversionRateSchema }),
    response: z.object({ change: currencyChangeRecordSchema, changedCount: z.number().int().nonnegative() }),
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
