import { randomUUID } from "node:crypto";

import {
  ArtifactPaths,
  WorkspaceStore,
  calculateScenarios,
  competitorStatistics,
  fingerprintContents,
  importV0Project,
  renderOpportunityReport,
} from "@open-merchant/core";
import type {
  Competitor,
  CompetitorStatistics,
  CostAssumptions,
  EconomicsScenario,
  EvidenceSource,
  Manifest,
  ProvenanceRecord,
  ReportSections,
  RunRecord,
} from "@open-merchant/shared";
import { AppError } from "@open-merchant/shared";

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

  constructor(appVersion: string) {
    this.appVersion = appVersion;
  }

  async openStore(root: string): Promise<WorkspaceStore> {
    try {
      return await WorkspaceStore.open(root);
    } catch (error) {
      throw toAppError(error);
    }
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
    return this.openStore(root).then((store) => store.loadEvidence());
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

  async saveEvidence(root: string, sources: EvidenceSource[]): Promise<void> {
    const store = await this.openStore(root);
    await store.saveEvidence(sources);
  }

  loadCompetitors(root: string): Promise<Competitor[]> {
    return this.openStore(root).then((store) => store.loadCompetitors());
  }

  async saveCompetitors(root: string, competitors: Competitor[]): Promise<void> {
    const store = await this.openStore(root);
    await store.saveCompetitors(competitors);
  }

  async competitorStatistics(root: string): Promise<CompetitorStatistics> {
    const store = await this.openStore(root);
    return competitorStatistics(await store.loadCompetitors());
  }

  loadAssumptions(root: string): Promise<CostAssumptions> {
    return this.openStore(root).then((store) => store.loadAssumptions());
  }

  async saveAssumptions(root: string, assumptions: CostAssumptions): Promise<void> {
    const store = await this.openStore(root);
    await store.saveAssumptions(assumptions);
  }

  async calculateScenarios(root: string): Promise<EconomicsScenario[]> {
    const store = await this.openStore(root);
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

    const completedAt = new Date().toISOString();
    await store.journal
      .appendRun({
        runId: `RUN-${randomUUID()}`,
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
    return this.openStore(root).then((store) => store.loadScenarios());
  }

  loadReportSections(root: string): Promise<ReportSections> {
    return this.openStore(root).then((store) => store.loadReportSections());
  }

  async saveReportSections(root: string, sections: ReportSections): Promise<void> {
    const store = await this.openStore(root);
    await store.saveReportSections(sections);
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
    return this.openStore(root).then((store) => store.loadOpportunityReport());
  }

  listRuns(root: string): Promise<RunRecord[]> {
    return this.openStore(root).then((store) => store.journal.listRuns());
  }

  listProvenance(root: string): Promise<ProvenanceRecord[]> {
    return this.openStore(root).then((store) => store.journal.listProvenance());
  }

  listArtifacts(root: string): ReturnType<WorkspaceStore["listArtifacts"]> {
    return this.openStore(root).then((store) => store.listArtifacts());
  }

  readArtifact(root: string, relativePath: string): Promise<string> {
    return this.openStore(root).then((store) => store.readArtifactText(relativePath));
  }
}
