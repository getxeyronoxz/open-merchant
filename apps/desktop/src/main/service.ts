import { randomUUID } from "node:crypto";

import {
  ArtifactPaths,
  DomainError,
  ValidationError,
  WorkspaceStore,
  calculateScenarios,
  competitorStatistics,
  fingerprintContents,
  importV0Project,
  nextSequentialId,
  renderOpportunityReport,
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
import type {
  AiOrigin,
  AuditReport,
  CompetitorDraft,
  EconomicsReview,
  ResearchPlan,
  Competitor,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  GenerationOrigin,
  ListingPriceHistory,
  Manifest,
  MarketSnapshot,
  ProvenanceRecord,
  ReportSections,
  RunRecord,
  SnapshotDiff,
} from "@open-merchant/shared";
import { AppError } from "@open-merchant/shared";

import type { AiConfigStore } from "./ai-config";
import type { HistoryKind } from "@open-merchant/core";

/** Maps agent-layer failures to coded app errors. */
async function runAgent<T>(work: () => Promise<T>): Promise<T> {
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

  constructor(appVersion: string, aiConfig?: AiConfigStore) {
    this.appVersion = appVersion;
    this.aiConfig = aiConfig ?? null;
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

  async saveCompetitors(root: string, competitors: Competitor[]): Promise<void> {
    const store = await this.openStore(root);
    await this.run(() => store.saveCompetitors(competitors));
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
        sections: await store.loadReportSections(),
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
