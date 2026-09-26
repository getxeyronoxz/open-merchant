import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  ArtifactPaths,
  DomainError,
  ValidationError,
  WorkspaceError,
  WorkspaceStore,
  appendPluginSections,
  calculateScenarios,
  competitorStatistics,
  createArchive,
  decisionJournal,
  fingerprintContents,
  importV0Project,
  marginMonitor,
  nextSequentialId,
  projectFolderName,
  readArchive,
  renderOpportunityReport,
  planCurrencyChange,
  SNOOZE_DAYS,
  standingReviews,
  type StandingReviewInput,
  worstFlagStatus,
  writeCurrencyPlan,
  writeFileAtomically,
} from "@open-merchant/core";
import {
  AiParseError,
  AiProviderError,
  auditReport,
  draftCompetitorEntries,
  draftEvidenceSource,
  draftReportSections,
  draftResearchPlan,
  reviewEconomics,
} from "@open-merchant/ai";
import { createHash } from "node:crypto";

import {
  competitorSchema,
  costAssumptionsSchema,
  currencyChangePreviewSchema,
  economicsScenarioSchema,
  manifestSchema,
  type AiOrigin,
  type ArtifactFingerprint,
  type AuditReport,
  type Competitor,
  type CompetitorDraft,
  type CompetitorStatistics,
  type ConnectorDraft,
  type ConnectorOrigin,
  type CostAssumptions,
  type CurrencyChangePreview,
  type CurrencyChangeRecord,
  type DecisionJournal,
  type EconomicsReview,
  type EconomicsScenario,
  type EvidenceSource,
  type GenerationOrigin,
  type InstalledPlugin,
  type ListingPriceHistory,
  type Manifest,
  type MarginMonitorResult,
  type MarketSnapshot,
  type PortfolioEntry,
  type ReviewDisposition,
  type StandingReview,
  type ProvenanceRecord,
  type ProjectSnapshot,
  type ReportSections,
  type ResearchPlan,
  type RunRecord,
  type SnapshotDiff,
} from "@open-merchant/shared";
import { AppError } from "@open-merchant/shared";

import type { AiConfigStore } from "./ai-config";
import type { PluginStore } from "./plugin-store";
import {
  fetchFromConnector as runConnector,
  type ConnectorClientFactory,
} from "./connector-client";
import type { HistoryKind } from "@open-merchant/core";

/** Maps agent-layer failures to coded app errors. */
export async function runAgent<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AiParseError) {
      throw new AppError({
        code: "ai-provider-error",
        message: "The model returned something unusable. Try again or edit by hand.",
        detail: error.message,
      });
    }
    if (error instanceof AiProviderError) {
      throw new AppError({
        code: "ai-provider-error",
        message: error.message,
        detail: error.raw,
      });
    }
    throw error;
  }
}

/**
 * Application service used by IPC handlers. A store is opened per call —
 * no long-lived handles, so external edits are always seen and a stale
 * workspace can never be written through.
 */

const INTERRUPTED_REPORT_MESSAGE =
  "Previous report generation was interrupted before completion. Review the artifacts, then generate again.";

const REPORT_INPUT_ARTIFACTS = [
  ArtifactPaths.manifest,
  ArtifactPaths.evidence,
  ArtifactPaths.competitors,
  ArtifactPaths.assumptions,
  ArtifactPaths.reportSections,
] as const;

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ValidationError || error instanceof DomainError) {
    return new AppError({ code: "invalid-input", message: error.message });
  }
  const message = error instanceof Error ? error.message : String(error);
  const code = /already exists/iu.test(message)
    ? "already-exists"
    : /not an Open Merchant project|No project folder/iu.test(message)
      ? "not-a-project"
      : /malformed/iu.test(message)
        ? "invalid-project"
        : "storage-error";
  return new AppError({
    code,
    message,
    detail: error instanceof Error ? error.stack : undefined,
  });
}

export class MerchantService {
  private readonly appVersion: string;
  private readonly aiConfig: AiConfigStore | null;
  private readonly plugins: PluginStore | null;

  constructor(appVersion: string, aiConfig?: AiConfigStore, plugins?: PluginStore) {
    this.appVersion = appVersion;
    this.aiConfig = aiConfig ?? null;
    this.plugins = plugins ?? null;
  }

  /**
   * Enabled report-section plugins, or an empty list when no plugin store is
   * wired. A plugin can only ever add static boilerplate: it never reads the
   * project and never writes to it.
   */
  private async enabledReportSectionPlugins(): Promise<InstalledPlugin[]> {
    if (!this.plugins) return [];
    const catalog = await this.plugins.list();
    return catalog.plugins.filter(
      (plugin) => plugin.enabled && plugin.manifest.kind === "report-section",
    );
  }

  async openStore(root: string): Promise<WorkspaceStore> {
    try {
      return await WorkspaceStore.open(root);
    } catch (error) {
      throw toAppError(error);
    }
  }

  /** Runs a store operation, mapping domain failures to coded AppErrors. */
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw toAppError(error);
    }
  }

  /** Opens the store and runs an operation with coded-error mapping. */
  private async withStore<T>(
    root: string,
    work: (store: WorkspaceStore) => Promise<T>,
  ): Promise<T> {
    const store = await this.openStore(root);
    return this.run(() => work(store));
  }

  async createProject(input: {
    parentDirectory: string;
    name: string;
    objective: string;
    currency: string;
  }): Promise<{ root: string; manifest: WorkspaceStore["manifest"] }> {
    try {
      const store = await WorkspaceStore.create(input);
      const now = new Date().toISOString();
      await store.journal.appendRun({
        runId: `RUN-${randomUUID()}`,
        operation: "projectCreated",
        startedAt: now,
        completedAt: now,
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts: [],
        outputArtifacts: [fingerprintContents(ArtifactPaths.manifest, JSON.stringify(store.manifest))],
        errorSummary: null,
      });
      return { root: store.root, manifest: store.manifest };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async importV0(v0Root: string, parentDirectory: string): Promise<{
    root: string;
    manifest: WorkspaceStore["manifest"];
    importedEvidence: number;
    importedCompetitors: number;
  }> {
    try {
      const readFile = async (path: string): Promise<string> => {
        const { readFile: nodeReadFile } = await import("node:fs/promises");
        return nodeReadFile(path, "utf8");
      };
      const result = await importV0Project(v0Root, parentDirectory, readFile);
      const store = await WorkspaceStore.open(result.newRoot);
      return {
        root: store.root,
        manifest: store.manifest,
        importedEvidence: result.importedEvidence,
        importedCompetitors: result.importedCompetitors,
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  loadEvidence(root: string): Promise<EvidenceSource[]> {
    return this.withStore(root, (store) => store.loadEvidence());
  }

  async saveManifest(root: string, manifest: Manifest): Promise<Manifest> {
    const store = await this.openStore(root);
    if (store.manifest.projectId !== manifest.projectId) {
      throw new AppError({
        code: "invalid-input",
        message: "Manifest identity does not match this project.",
      });
    }
    return store.saveManifest({ name: manifest.name, objective: manifest.objective });
  }

  async saveEvidence(
    root: string,
    sources: EvidenceSource[],
    origin?: GenerationOrigin,
  ): Promise<void> {
    const store = await this.openStore(root);
    await this.run(() => store.saveEvidence(sources));
    if (origin?.kind === "agent") {
      await this.journalAgentAcceptance(store, "agentDraftProduced", [ArtifactPaths.evidence], origin);
    }
  }

  loadCompetitors(root: string): Promise<Competitor[]> {
    return this.withStore(root, (store) => store.loadCompetitors());
  }

  async saveCompetitors(
    root: string,
    competitors: Competitor[],
    origin?: GenerationOrigin,
  ): Promise<void> {
    const store = await this.openStore(root);
    await this.run(() => store.saveCompetitors(competitors));
    if (origin?.kind === "agent") {
      await this.journalAgentAcceptance(store, "agentDraftProduced", [ArtifactPaths.competitors], origin);
    }
  }

  competitorStatistics(root: string): Promise<CompetitorStatistics> {
    return this.withStore(root, async (store) => competitorStatistics(await store.loadCompetitors()));
  }

  loadAssumptions(root: string): Promise<CostAssumptions> {
    return this.withStore(root, (store) => store.loadAssumptions());
  }

  async saveAssumptions(root: string, assumptions: CostAssumptions): Promise<void> {
    const store = await this.openStore(root);
    await this.run(() => store.saveAssumptions(assumptions));
  }

  async calculateScenarios(root: string): Promise<EconomicsScenario[]> {
    const store = await this.openStore(root);
    const runId = `RUN-${randomUUID()}`;
    let scenarios: EconomicsScenario[];
    try {
      scenarios = calculateScenarios(await store.loadAssumptions());
    } catch (error) {
      throw new AppError({
        code: "invalid-input",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const scenariosFingerprint = await store.saveScenarios(scenarios);

    // Immutable snapshot for "what changed since last time"; history must
    // never fail the calculation itself.
    await store.history
      .snapshot("scenarios", runId, `${JSON.stringify(scenarios, null, 2)}\n`)
      .catch(() => undefined);

    const completedAt = new Date().toISOString();
    await store.journal
      .appendProvenance({
        runId,
        artifactPath: ArtifactPaths.scenarios,
        sha256: scenariosFingerprint.sha256,
        generatedAt: completedAt,
        origin: { kind: "user" },
      })
      .catch(() => undefined); // journaling must never fail the calculation
    await store.journal
      .appendRun({
        runId,
        operation: "economicsGenerated",
        startedAt: completedAt,
        completedAt,
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts: [fingerprintContents(ArtifactPaths.assumptions, JSON.stringify(await store.loadAssumptions()))],
        outputArtifacts: [scenariosFingerprint],
        errorSummary: null,
      })
      .catch(() => undefined); // journaling must never fail the calculation
    return scenarios;
  }

  loadScenarios(root: string): Promise<EconomicsScenario[]> {
    return this.withStore(root, (store) => store.loadScenarios());
  }

  loadReportSections(root: string): Promise<ReportSections> {
    return this.withStore(root, (store) => store.loadReportSections());
  }

  async saveReportSections(
    root: string,
    sections: ReportSections,
    origin?: GenerationOrigin,
  ): Promise<void> {
    const store = await this.openStore(root);
    await this.run(() => store.saveReportSections(sections));
    if (origin?.kind === "agent") {
      await this.journalAgentAcceptance(store, "agentDraftProduced", [ArtifactPaths.reportSections], origin);
    }
  }

  /**
   * Records that the human accepted an AI-produced draft: a run entry plus
   * provenance rows carrying provider, model, and prompt hash — so every
   * AI-touched artifact stays auditable.
   */
  private async journalAgentAcceptance(
    store: WorkspaceStore,
    _operation: "agentDraftProduced",
    artifactPaths: readonly string[],
    origin: AiOrigin,
  ): Promise<void> {
    try {
      const runId = `RUN-${randomUUID()}`;
      const now = new Date().toISOString();
      const outputArtifacts = [];
      for (const relativePath of artifactPaths) {
        outputArtifacts.push(fingerprintContents(relativePath, await store.readArtifactText(relativePath)));
      }
      await store.journal.appendRun({
        runId,
        operation: "agentDraftProduced",
        startedAt: now,
        completedAt: now,
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts: [],
        outputArtifacts,
        errorSummary: null,
      });
      for (const artifact of outputArtifacts) {
        await store.journal.appendProvenance({
          runId,
          artifactPath: artifact.path,
          sha256: artifact.sha256,
          generatedAt: now,
          origin,
        });
      }
    } catch {
      // Journaling must never block an accepted save.
    }
  }

  // --- AI copilot ------------------------------------------------------------

  async draftEvidence(
    root: string,
    url: string,
    pageText: string,
  ): Promise<{ draft: EvidenceSource; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);
    const existing = await store.loadEvidence();
    const nextId = nextSequentialId("S", existing.map((source) => source.id));

    const { value, completion } = await runAgent(() =>
      draftEvidenceSource(provider, { nextId, url, pageText }),
    );
    return {
      draft: value,
      origin: {
        kind: "agent",
        agentId: "evidence-assistant",
        providerId: completion.providerId,
        modelId: completion.modelId,
        promptHash: completion.promptHash,
      },
    };
  }

  async draftSections(root: string): Promise<{ sections: ReportSections; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);

    const [evidence, competitors, assumptions, scenarios, existingSections] = await Promise.all([
      store.loadEvidence(),
      store.loadCompetitors(),
      store.loadAssumptions(),
      store.loadScenarios(),
      store.loadReportSections(),
    ]);
    const hasContent =
      evidence.length > 0 ||
      competitors.length > 0 ||
      scenarios.length > 0 ||
      existingSections.decisionSummary.length > 0;
    if (!hasContent) {
      throw new AppError({
        code: "invalid-input",
        message: "Add evidence or competitors before asking for drafted sections.",
      });
    }

    const { value, completion } = await runAgent(() =>
      draftReportSections(provider, {
        objective: store.manifest.objective,
        currency: store.manifest.currency,
        evidence: evidence.map(({ id, title, notes }) => ({ id, title, notes })),
        competitors: competitors.map(({ id, product, price, marketplace }) => ({
          id,
          product,
          price,
          marketplace,
        })),
        statistics: competitorStatistics(competitors),
        assumptions,
        scenarios,
        existingSections:
          existingSections.decisionSummary.length > 0 ? existingSections : undefined,
      }),
    );
    return {
      sections: value,
      origin: {
        kind: "agent",
        agentId: "report-writer",
        providerId: completion.providerId,
        modelId: completion.modelId,
        promptHash: completion.promptHash,
      },
    };
  }

  async draftPlan(root: string): Promise<{ plan: ResearchPlan; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);
    const { value, completion } = await runAgent(() =>
      draftResearchPlan(provider, store.manifest.objective, store.manifest.currency),
    );
    return { plan: value, origin: this.aiOrigin("research-planner", completion) };
  }

  async draftCompetitors(
    root: string,
    pastedListings: string,
  ): Promise<{ competitors: CompetitorDraft[]; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);
    const { value, completion } = await runAgent(() =>
      draftCompetitorEntries(provider, {
        currency: store.manifest.currency,
        pastedListings,
      }),
    );
    return { competitors: value, origin: this.aiOrigin("competitor-analyst", completion) };
  }

  async reviewEconomicsFor(root: string): Promise<{ review: EconomicsReview; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);
    const [assumptions, scenarios] = await Promise.all([
      store.loadAssumptions(),
      store.loadScenarios(),
    ]);
    if (scenarios.length === 0) {
      throw new AppError({
        code: "invalid-input",
        message: "Calculate scenarios before asking for a review.",
      });
    }
    const statistics = competitorStatistics(await store.loadCompetitors());
    const { value, completion } = await runAgent(() =>
      reviewEconomics(provider, { assumptions, scenarios, statistics }),
    );
    return { review: value, origin: this.aiOrigin("economics-reviewer", completion) };
  }

  async auditGeneratedReport(root: string): Promise<{ audit: AuditReport; origin: AiOrigin }> {
    if (!this.aiConfig) {
      throw new AppError({ code: "ai-not-configured", message: "AI is unavailable in this build." });
    }
    const provider = await this.aiConfig.getActiveProvider();
    const store = await this.openStore(root);
    const markdown = await store.loadOpportunityReport();
    if (markdown === null) {
      throw new AppError({
        code: "invalid-input",
        message: "Generate the report before running the auditor.",
      });
    }
    const evidence = await store.loadEvidence();
    const { value, completion } = await runAgent(() =>
      auditReport(provider, {
        reportMarkdown: markdown,
        evidenceSummaries: evidence.map(({ id, title, notes }) => ({ id, title, notes })),
      }),
    );
    return { audit: value, origin: this.aiOrigin("auditor", completion) };
  }

  private aiOrigin(
    agentId: string,
    completion: { providerId: string; modelId: string; promptHash: string },
  ): AiOrigin {
    return {
      kind: "agent",
      agentId,
      providerId: completion.providerId,
      modelId: completion.modelId,
      promptHash: completion.promptHash,
    };
  }

  /**
   * Deterministic report generation with the legacy recoverable-run flow:
   * a failed run is journaled first; on success it is replaced with the
   * succeeded record, and every generated artifact gains provenance.
   */
  async generateReport(root: string): Promise<string> {
    const store = await this.openStore(root);
    const startedAt = new Date().toISOString();
    const runId = `RUN-${randomUUID()}`;
    const now = () => new Date().toISOString();

    const inputArtifacts = [];
    for (const relative of REPORT_INPUT_ARTIFACTS) {
      inputArtifacts.push(fingerprintContents(relative, await store.readArtifactText(relative)));
    }

    await store.journal.appendRun({
      runId,
      operation: "reportGenerated",
      startedAt,
      completedAt: now(),
      status: "failed",
      appVersion: this.appVersion,
      inputArtifacts,
      outputArtifacts: [],
      errorSummary: INTERRUPTED_REPORT_MESSAGE,
    });

    const outputArtifacts = [];
    try {
      const assumptions = await store.loadAssumptions();
      const scenarios = calculateScenarios(assumptions);
      outputArtifacts.push(await store.saveScenarios(scenarios));

      const markdown = renderOpportunityReport({
        manifest: store.manifest,
        sections: appendPluginSections(
          await store.loadReportSections(),
          await this.enabledReportSectionPlugins(),
        ),
        evidence: await store.loadEvidence(),
        competitorStatistics: competitorStatistics(await store.loadCompetitors()),
        scenarios,
        runId,
        generatedAt: new Date().toISOString().replace("Z", "+00:00"),
      });
      outputArtifacts.push(await store.writeOpportunityReport(markdown));

      // Immutable snapshots backing the artifact viewer's diff; history must
      // never fail the report itself.
      await store.history
        .snapshot("scenarios", runId, `${JSON.stringify(scenarios, null, 2)}\n`)
        .catch(() => undefined);
      await store.history.snapshot("report", runId, markdown).catch(() => undefined);

      for (const artifact of outputArtifacts) {
        await store.journal.appendProvenance({
          runId,
          artifactPath: artifact.path,
          sha256: artifact.sha256,
          generatedAt: now(),
          origin: { kind: "user" },
        });
      }

      await store.journal.replaceRun({
        runId,
        operation: "reportGenerated",
        startedAt,
        completedAt: now(),
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts,
        outputArtifacts,
        errorSummary: null,
      });
      return markdown;
    } catch (error) {
      await store.journal
        .replaceRun({
          runId,
          operation: "reportGenerated",
          startedAt,
          completedAt: now(),
          status: "failed",
          appVersion: this.appVersion,
          inputArtifacts,
          outputArtifacts,
          errorSummary: `${INTERRUPTED_REPORT_MESSAGE} ${error instanceof Error ? error.message : String(error)}`,
        })
        .catch(() => undefined);
      throw toAppError(error);
    }
  }

  loadGeneratedReport(root: string): Promise<string | null> {
    return this.withStore(root, (store) => store.loadOpportunityReport());
  }

  listRuns(root: string): Promise<RunRecord[]> {
    return this.withStore(root, (store) => store.journal.listRuns());
  }

  /**
   * Runs one enabled connector and returns its output as drafts.
   *
   * Nothing is written to the project. A connector is a third-party program
   * running as the user; the one thing it may ever produce is a draft a human
   * accepts on the Draft Desk. A fetch that fails writes nothing at all — not
   * even a run record — so a broken process cannot leave a trace in a project
   * it was only ever allowed to read.
   */
  async fetchFromConnector(
    root: string,
    pluginId: string,
    query: string,
    createClient?: ConnectorClientFactory,
  ): Promise<{ drafts: ConnectorDraft[]; fetchedAt: string }> {
    const store = await this.openStore(root);
    return this.run(async () => {
      const catalog = this.plugins ? await this.plugins.list() : { plugins: [], broken: [] };
      const plugin = catalog.plugins.find((entry) => entry.manifest.id === pluginId);
      if (!plugin || plugin.manifest.kind !== "connector") {
        throw new AppError({ code: "not-found", message: `No connector named "${pluginId}" is installed.` });
      }
      if (!plugin.enabled) {
        throw new AppError({ code: "not-found", message: `Connector "${pluginId}" is disabled.` });
      }

      const fetchedAt = new Date().toISOString();
      const result = await runConnector(
        plugin.manifest,
        plugin.directory,
        { query },
        createClient,
      );
      const origin: ConnectorOrigin = {
        kind: "connector",
        connectorId: plugin.manifest.id,
        pluginId,
        fetchedAt,
        rawResponseHash: result.rawResponseHash,
      };
      // Two fetches can land in the same millisecond, so the id carries a
      // random suffix rather than treating the timestamp as unique.
      const stem = `DRAFT-${pluginId}-${fetchedAt.replace(/\D/gu, "")}-${randomUUID().slice(0, 8)}`;
      const drafts: ConnectorDraft[] = [];
      const [firstEvidence] = result.result.evidence;
      if (firstEvidence) {
        drafts.push({ id: `${stem}-E`, kind: "evidence", origin, createdAt: fetchedAt, value: firstEvidence });
      }
      if (result.result.competitors.length > 0) {
        drafts.push({
          id: `${stem}-C`,
          kind: "competitors",
          origin,
          createdAt: fetchedAt,
          value: result.result.competitors,
        });
      }

      await store.journal.appendRun({
        runId: `RUN-${randomUUID()}`,
        operation: "connectorFetched",
        startedAt: fetchedAt,
        completedAt: new Date().toISOString(),
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts: [],
        outputArtifacts: [],
        errorSummary: null,
      });
      return { drafts, fetchedAt };
    });
  }

  /** Captures an immutable market snapshot and journals it. */
  async captureMarketSnapshot(root: string, note: string): Promise<MarketSnapshot> {
    const store = await this.openStore(root);
    return this.run(async () => {
      const startedAt = new Date().toISOString();
      const runId = `RUN-${randomUUID()}`;
      const result = await store.captureMarketSnapshot(note);
      const competitorText = await store.readArtifactText(ArtifactPaths.competitors).catch(() => "");
      await store.journal.appendRun({
        runId,
        operation: "snapshotCaptured",
        startedAt,
        completedAt: new Date().toISOString(),
        status: "succeeded",
        appVersion: this.appVersion,
        inputArtifacts: [fingerprintContents(ArtifactPaths.competitors, competitorText)],
        outputArtifacts: [result.fingerprint],
        errorSummary: null,
      });
      return result.snapshot;
    });
  }

  listMarketSnapshots(root: string): Promise<MarketSnapshot[]> {
    return this.withStore(root, (store) => store.listMarketSnapshots());
  }

  snapshotDiff(root: string, fromId: string, toId: string): Promise<SnapshotDiff> {
    return this.withStore(root, (store) => store.snapshotDiff(fromId, toId));
  }

  listingPriceHistory(root: string): Promise<ListingPriceHistory[]> {
    return this.withStore(root, (store) => store.listingPriceHistory());
  }

  /** Deterministic margin-drift monitor over the latest snapshot's median. */
  marginMonitor(root: string): Promise<MarginMonitorResult> {
    return this.withStore(root, async (store) => {
      const assumptions = await store.loadAssumptions();
      const scenarios = await store.loadScenarios();
      const snapshots = await store.listMarketSnapshots();
      const latest = snapshots[0] ?? null;
      return marginMonitor(
        assumptions,
        scenarios,
        latest?.statistics.median ?? null,
        latest?.id ?? null,
      );
    });
  }

  /** Dated report generations plus stale evidence, as of now. */
  decisionJournal(root: string): Promise<DecisionJournal> {
    return this.withStore(root, async (store) =>
      decisionJournal(await store.journal.listRuns(), await store.loadEvidence(), new Date()),
    );
  }

  /**
   * Reads one project into the shape the standing-review derivation wants.
   *
   * This is where a project that cannot be opened stops mattering: the caller
   * catches the failure and omits it. A queue that refused to render because
   * one folder in the portfolio is unreadable would be worse than a queue with
   * a gap in it.
   */
  private async standingReviewInput(
    root: string,
  ): Promise<StandingReviewInput & { name: string }> {
    const store = await this.openStore(root);
    const snapshots = await store.listMarketSnapshots();
    return {
      root,
      name: store.manifest.name,
      runs: await store.journal.listRuns(),
      evidence: await store.loadEvidence(),
      assumptions: await store.loadAssumptions(),
      scenarios: await store.loadScenarios(),
      snapshots,
    };
  }

  /**
   * The attention queue across every project the app knows about — what needs
   * attention this week, worst and oldest first. Purely local: the signals come
   * from artifacts already on disk, and nothing here contacts a service.
   */
  async standingReviews(recents: readonly { name: string; path: string }[]): Promise<StandingReview[]> {
    const now = new Date();
    const inputs = await Promise.all(
      recents.map(async (recent) => {
        try {
          return await this.standingReviewInput(recent.path);
        } catch {
          // An unreadable project is omitted rather than fatal, matching how
          // the portfolio still lists a project it could not open.
          return null;
        }
      }),
    );
    return standingReviews(inputs.filter((input): input is StandingReviewInput => input !== null), now);
  }

  /**
   * Snoozes or dismisses one review, on the record.
   *
   * The review is looked up in a freshly derived queue and *its* due date is
   * what gets recorded, so a caller cannot silence a different occurrence of
   * the same condition by asserting a date of its own. A key that is not
   * currently showing is refused: there is nothing to silence, and recording a
   * disposition for it would only be a claim nobody can check.
   */
  async disposeReview(
    root: string,
    reviewKey: string,
    action: "snoozed" | "dismissed",
  ): Promise<ReviewDisposition> {
    const now = new Date();
    const input = await this.standingReviewInput(root);
    const review = standingReviews([input], now).find((entry) => entry.key === reviewKey);
    if (!review) {
      throw new AppError({
        code: "not-found",
        message: "That review is no longer showing, so there is nothing to snooze.",
      });
    }
    const until =
      action === "snoozed" ? new Date(now.getTime() + SNOOZE_DAYS * 86_400_000).toISOString() : null;
    const disposition: ReviewDisposition = {
      reviewKey,
      action,
      reviewDueAt: review.dueAt,
      until,
      recordedAt: now.toISOString(),
    };
    const store = await this.openStore(root);
    await store.journal.appendRun({
      runId: `RUN-${randomUUID()}`,
      operation: action === "snoozed" ? "reviewSnoozed" : "reviewDismissed",
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      status: "succeeded",
      appVersion: this.appVersion,
      inputArtifacts: [],
      outputArtifacts: [],
      errorSummary: null,
      review: disposition,
    });
    return disposition;
  }

  /**
   * Reads the project and derives what a currency change would do to it.
   * Writes nothing: the seller has to see the diff and confirm it.
   *
   * The request carries only an intent — a currency and a rate. Nothing about
   * the plan crosses this boundary, so a preview the renderer could have built
   * or edited has no way to decide what gets written.
   */
  private async currencyChangePlan(root: string, toCurrency: string, rate: string) {
    return this.run(async () => {
      const store = await this.openStore(root);
      const manifest = store.manifest;
      // Absence is decided by asking what exists, never by swallowing a read
      // error. A project that has never calculated has no scenarios file; a
      // project whose assumptions cannot be read must be refused outright,
      // because converting everything except the one artifact that failed to
      // load is a silent partial change — the exact outcome this operation
      // exists to avoid.
      const present = new Set(
        (await store.listArtifacts())
          .filter((artifact) => artifact.exists)
          .map((artifact) => artifact.path),
      );
      const optional = (relativePath: string): Promise<string | null> =>
        present.has(relativePath) ? store.readArtifactText(relativePath) : Promise.resolve(null);
      const [competitorsRaw, assumptionsRaw, scenariosRaw, snapshots] = await Promise.all([
        optional(ArtifactPaths.competitors),
        optional(ArtifactPaths.assumptions),
        optional(ArtifactPaths.scenarios),
        store.listMarketSnapshots(),
      ]);
      const parse = <T>(raw: string | null, schema: { parse: (value: unknown) => T }): T | null =>
        raw === null ? null : schema.parse(JSON.parse(raw));

      return planCurrencyChange({
        fromCurrency: manifest.currency,
        toCurrency,
        rate,
        changedAt: new Date().toISOString(),
        manifest,
        competitors: parse(competitorsRaw, competitorSchema.array()),
        assumptions: parse(assumptionsRaw, costAssumptionsSchema),
        scenarios: parse(scenariosRaw, economicsScenarioSchema.array()),
        snapshots,
      });
    });
  }

  async currencyPreview(
    root: string,
    toCurrency: string,
    rate: string,
  ): Promise<CurrencyChangePreview> {
    const plan = await this.currencyChangePlan(root, toCurrency, rate);
    return currencyChangePreviewSchema.parse({
      fromCurrency: plan.fromCurrency,
      toCurrency: plan.toCurrency,
      rate: plan.rate,
      createdAt: plan.changedAt,
      affectedArtifacts: plan.artifacts.map((artifact) => ({
        path: artifact.path,
        sha256: createHash("sha256").update(artifact.after).digest("hex"),
      })),
      beforeHash: plan.beforeHash,
      afterHash: plan.afterHash,
      oldValues: { ...plan.oldValues },
      newValues: { ...plan.newValues },
      changedCount: Object.keys(plan.newValues).length,
    });
  }

  /**
   * Restates the project in another currency, on the record.
   *
   * The plan is derived here rather than taken from the caller, so a seller who
   * edited a competitor price between the preview and this call gets the
   * current price converted and the journal records the value that was really
   * on disk. The journal entry is appended only once the folder is known to
   * hold what the record describes; a change that cannot land rolls itself back
   * and is recorded as the failure it was.
   */
  async applyCurrencyChange(
    root: string,
    toCurrency: string,
    rate: string,
  ): Promise<{ change: CurrencyChangeRecord; changedCount: number; snapshot: ProjectSnapshot }> {
    const startedAt = new Date().toISOString();
    const runId = `RUN-${randomUUID()}`;
    const store = await this.openStore(root);
    const plan = await this.currencyChangePlan(root, toCurrency, rate);
    const change: CurrencyChangeRecord = {
      runId,
      fromCurrency: plan.fromCurrency,
      toCurrency: plan.toCurrency,
      rate: plan.rate,
      changedAt: plan.changedAt,
      affectedArtifacts: plan.artifacts.map((artifact) => ({
        path: artifact.path,
        sha256: createHash("sha256").update(artifact.after).digest("hex"),
      })),
      beforeHash: plan.beforeHash,
      afterHash: plan.afterHash,
      oldValues: { ...plan.oldValues },
      newValues: { ...plan.newValues },
    };
    let written: ArtifactFingerprint[];
    try {
      written = await writeCurrencyPlan(root, plan);
    } catch (error) {
      // A change that could not land journals as the failure it was, with no
      // payload: a run record cannot describe a conversion that did not happen.
      // The plan has already put back what it took, so the folder is whole.
      await store.journal.appendRun({
        runId,
        operation: "currencyChanged",
        startedAt,
        completedAt: new Date().toISOString(),
        status: "failed",
        appVersion: this.appVersion,
        inputArtifacts: [],
        outputArtifacts: [],
        errorSummary: error instanceof Error ? error.message : String(error),
      });
      throw toAppError(error);
    }
    await store.journal.appendRun({
      runId,
      operation: "currencyChanged",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "succeeded",
      appVersion: this.appVersion,
      inputArtifacts: [],
      outputArtifacts: written,
      errorSummary: null,
      currencyChange: change,
    });
    return {
      change,
      changedCount: Object.keys(change.newValues).length,
      // Re-read rather than patch: the manifest on disk is the canonical
      // currency now, and the UI is told what the folder actually says.
      snapshot: { root, manifest: (await this.openStore(root)).manifest },
    };
  }

  /** File-first pillar: CSV export of the requested table. */
  async exportCsv(root: string, kind: "competitors" | "evidence" | "scenarios") {
    return this.withStore(root, async (store) => ({
      csv: await store.exportCsv(kind),
      filename: `${projectFolderName(store.manifest.name)}-${kind}.csv`,
    }));
  }

  /** File-first pillar: validated CSV import with row-level error reporting. */
  importCompetitorsCsv(
    root: string,
    csvText: string,
    mapping: Record<string, string> | undefined,
  ): Promise<{ imported: number; skipped: number; errors: { row: number; message: string }[] }> {
    return this.withStore(root, (store) =>
      store.importCompetitorsCsv(csvText, mapping ?? {}),
    );
  }

  /** File-first pillar: portable single-file project archive. */
  async createArchive(root: string): Promise<{ archiveBase64: string; filename: string }> {
    return this.withStore(root, async (store) => {
      const bytes = createArchive(await store.listArchiveFiles());
      return {
        archiveBase64: bytes.toString("base64"),
        filename: `${projectFolderName(store.manifest.name)}-${new Date().toISOString().slice(0, 10)}.omarchive`,
      };
    });
  }

  /** File-first pillar: restore an archive into a fresh project folder. */
  async restoreArchive(
    parentDirectory: string,
    archiveBase64: string,
  ): Promise<{ root: string; manifest: Manifest }> {
    const files = readArchive(Buffer.from(archiveBase64, "base64"));
    const manifestFile = files.find((file) => file.path === ArtifactPaths.manifest);
    if (manifestFile === undefined) {
      throw new AppError({
        code: "invalid-input",
        message: "The archive does not contain a project manifest.",
      });
    }
    const archived = manifestSchema.parse(JSON.parse(manifestFile.content));
    let store: WorkspaceStore | null = null;
    for (let attempt = 0; attempt < 5 && store === null; attempt += 1) {
      const name = attempt === 0 ? archived.name : `${archived.name} (restored ${attempt})`;
      try {
        store = await WorkspaceStore.create({
          parentDirectory,
          name,
          objective: archived.objective,
          currency: archived.currency,
        });
      } catch (error) {
        if (!(error instanceof WorkspaceError) || !/already exists/iu.test(error.message)) {
          throw toAppError(error);
        }
      }
    }
    if (store === null) {
      throw new AppError({
        code: "already-exists",
        message: "Could not find a free project name to restore into.",
      });
    }
    // The freshly created store holds seeded defaults; overwrite everything
    // the archive carries except the manifest (its identity stays new).
    for (const file of files) {
      if (file.path === ArtifactPaths.manifest) continue;
      await writeFileAtomically(join(store.root, ...file.path.split("/")), file.content);
    }
    return { root: store.root, manifest: store.manifest };
  }

  /**
   * Portfolio overview (phase 2): every known project with decision status,
   * snapshot age, and margin flags — sorted so attention-needing projects
   * surface first. Projects that cannot be opened still appear, flagged.
   */
  async portfolioOverview(
    recents: readonly { name: string; path: string }[],
  ): Promise<PortfolioEntry[]> {
    const entries = await Promise.all(
      recents.map(async (recent): Promise<PortfolioEntry> => {
        try {
          const store = await this.openStore(recent.path);
          const runs = await store.journal.listRuns();
          const reportRuns = runs
            .filter((run) => run.operation === "reportGenerated" && run.status === "succeeded")
            .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
          const lastReportAt =
            reportRuns.length > 0
              ? (reportRuns[reportRuns.length - 1] as RunRecord).completedAt
              : null;
          const assumptions = await store.loadAssumptions();
          const scenarios = await store.loadScenarios();
          const snapshots = await store.listMarketSnapshots();
          const latest = snapshots[0] ?? null;
          const monitor = marginMonitor(
            assumptions,
            scenarios,
            latest?.statistics.median ?? null,
            latest?.id ?? null,
          );
          const flags = monitor.flags.filter(
            (flag): flag is typeof flag & { status: "healthy" | "watch" | "breached" } =>
              flag.status !== "unmonitored",
          );
          return {
            root: recent.path,
            name: store.manifest.name,
            currency: store.manifest.currency,
            hasReport: reportRuns.length > 0,
            lastReportAt,
            snapshotCapturedAt: latest?.capturedAt ?? null,
            snapshotAgeDays:
              latest === null
                ? null
                : Math.max(0, Math.floor((Date.now() - Date.parse(latest.capturedAt)) / 86_400_000)),
            thresholdPercent: monitor.thresholdPercent,
            worstStatus: worstFlagStatus(flags),
            flags: flags.map((flag) => ({ scenario: flag.scenario, status: flag.status })),
          };
        } catch {
          return {
            root: recent.path,
            name: recent.name,
            currency: "",
            hasReport: false,
            lastReportAt: null,
            snapshotCapturedAt: null,
            snapshotAgeDays: null,
            thresholdPercent: null,
            worstStatus: "none",
            flags: [],
          };
        }
      }),
    );
    const severity = { breached: 0, watch: 1, healthy: 2, none: 3 } as const;
    return entries.sort(
      (a, b) => severity[a.worstStatus] - severity[b.worstStatus] || a.name.localeCompare(b.name),
    );
  }

  listProvenance(root: string): Promise<ProvenanceRecord[]> {
    return this.withStore(root, (store) => store.journal.listProvenance());
  }

  readHistory(root: string, kind: HistoryKind, runId: string): Promise<string | null> {
    return this.withStore(root, (store) => store.history.readSnapshot(kind, runId));
  }

  listArtifacts(root: string): ReturnType<WorkspaceStore["listArtifacts"]> {
    return this.withStore(root, (store) => store.listArtifacts());
  }

  readArtifact(root: string, relativePath: string): Promise<string> {
    return this.withStore(root, (store) => store.readArtifactText(relativePath));
  }
}
