import {
  AppError,
  appErrorSchema,
  ipc,
  ipcEnvelopeSchema,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
} from "@open-merchant/shared";

/**
 * The only way the renderer talks to the desktop shell. The renderer never
 * imports Electron; it consumes this typed client. Responses are validated
 * against the shared contract before they reach the UI, and every failure is
 * surfaced as a coded {@link AppError} — errors are never swallowed.
 */

export type RawInvoke = (channel: string, request: unknown) => Promise<unknown>;

async function invoke<C extends IpcChannel>(
  raw: RawInvoke,
  channel: C,
  request: IpcRequest<C>,
): Promise<IpcResponse<C>> {
  const envelope = ipcEnvelopeSchema.parse(await raw(channel, request));
  if (!envelope.ok) {
    throw new AppError(appErrorSchema.parse(envelope.error));
  }
  return ipc[channel].response.parse(envelope.value) as IpcResponse<C>;
}

function bind<C extends IpcChannel>(raw: RawInvoke, channel: C): (request: IpcRequest<C>) => Promise<IpcResponse<C>> {
  return (request) => invoke(raw, channel, request);
}

export interface DesktopClient {
  appInfo(): Promise<IpcResponse<"app/info">>;
  installUpdate(): Promise<IpcResponse<"update/install">>;
  chooseDirectory(title: string): Promise<IpcResponse<"dialog/choose-directory">>;
  createProject(request: IpcRequest<"project/create">): Promise<IpcResponse<"project/create">>;
  openProject(request: IpcRequest<"project/open">): Promise<IpcResponse<"project/open">>;
  saveManifest(root: string, manifest: IpcRequest<"manifest/save">["manifest"]): Promise<IpcResponse<"manifest/save">>;
  importV0Project(request: IpcRequest<"project/import-v0">): Promise<IpcResponse<"project/import-v0">>;
  listRecents(): Promise<IpcResponse<"recents/list">>;
  removeRecent(request: IpcRequest<"recents/remove">): Promise<IpcResponse<"recents/remove">>;

  loadEvidence(root: string): Promise<IpcResponse<"evidence/load">>;
  saveEvidence(
    root: string,
    sources: IpcRequest<"evidence/save">["sources"],
    origin?: IpcRequest<"evidence/save">["origin"],
  ): Promise<IpcResponse<"evidence/save">>;

  loadCompetitors(root: string): Promise<IpcResponse<"competitors/load">>;
  saveCompetitors(root: string, competitors: IpcRequest<"competitors/save">["competitors"]): Promise<IpcResponse<"competitors/save">>;
  competitorStatistics(root: string): Promise<IpcResponse<"competitors/statistics">>;

  loadAssumptions(root: string): Promise<IpcResponse<"assumptions/load">>;
  saveAssumptions(root: string, assumptions: IpcRequest<"assumptions/save">["assumptions"]): Promise<IpcResponse<"assumptions/save">>;
  calculateScenarios(root: string): Promise<IpcResponse<"economics/calculate">>;
  loadScenarios(root: string): Promise<IpcResponse<"scenarios/load">>;

  loadReportSections(root: string): Promise<IpcResponse<"report/sections/load">>;
  saveReportSections(
    root: string,
    sections: IpcRequest<"report/sections/save">["sections"],
    origin?: IpcRequest<"report/sections/save">["origin"],
  ): Promise<IpcResponse<"report/sections/save">>;
  generateReport(root: string): Promise<IpcResponse<"report/generate">>;
  loadGeneratedReport(root: string): Promise<IpcResponse<"report/load-generated">>;

  listArtifacts(root: string): Promise<IpcResponse<"artifacts/list">>;
  readArtifact(root: string, relativePath: string): Promise<IpcResponse<"artifacts/read">>;
  listRuns(root: string): Promise<IpcResponse<"runs/list">>;
  listProvenance(root: string): Promise<IpcResponse<"provenance/list">>;
  readHistory(
    root: string,
    kind: IpcRequest<"history/read">["kind"],
    runId: string,
  ): Promise<IpcResponse<"history/read">>;

  captureMarketSnapshot(root: string, note: string): Promise<IpcResponse<"snapshots/capture">>;
  listMarketSnapshots(root: string): Promise<IpcResponse<"snapshots/list">>;
  snapshotDiff(root: string, fromId: string, toId: string): Promise<IpcResponse<"snapshots/diff">>;
  listingPriceHistory(root: string): Promise<IpcResponse<"snapshots/history">>;

  loadAiConfig(): Promise<IpcResponse<"ai/config/load">>;
  saveAiConfig(request: IpcRequest<"ai/config/save">): Promise<IpcResponse<"ai/config/save">>;
  testAi(providerId: IpcRequest<"ai/test">["providerId"]): Promise<IpcResponse<"ai/test">>;
  draftEvidence(root: string, url: string, pageText: string): Promise<IpcResponse<"ai/draft-evidence">>;
  draftSections(root: string): Promise<IpcResponse<"ai/draft-sections">>;
  draftPlan(root: string): Promise<IpcResponse<"ai/draft-plan">>;
  draftCompetitors(
    root: string,
    pastedListings: string,
  ): Promise<IpcResponse<"ai/draft-competitors">>;
  reviewEconomics(root: string): Promise<IpcResponse<"ai/review-economics">>;
  auditReport(root: string): Promise<IpcResponse<"ai/audit-report">>;
}

export function createDesktopClient(raw: RawInvoke): DesktopClient {
  return {
    appInfo: () => invoke(raw, "app/info", {}),
    installUpdate: () => invoke(raw, "update/install", {}),
    chooseDirectory: (title) => invoke(raw, "dialog/choose-directory", { title }),
    createProject: bind(raw, "project/create"),
    openProject: bind(raw, "project/open"),
    saveManifest: (root, manifest) => invoke(raw, "manifest/save", { root, manifest }),
    importV0Project: bind(raw, "project/import-v0"),
    listRecents: () => invoke(raw, "recents/list", {}),
    removeRecent: bind(raw, "recents/remove"),

    loadEvidence: (root) => invoke(raw, "evidence/load", { root }),
    saveEvidence: (root, sources, origin) => invoke(raw, "evidence/save", { root, sources, origin }),

    loadCompetitors: (root) => invoke(raw, "competitors/load", { root }),
    saveCompetitors: (root, competitors) => invoke(raw, "competitors/save", { root, competitors }),
    competitorStatistics: (root) => invoke(raw, "competitors/statistics", { root }),

    loadAssumptions: (root) => invoke(raw, "assumptions/load", { root }),
    saveAssumptions: (root, assumptions) => invoke(raw, "assumptions/save", { root, assumptions }),
    calculateScenarios: (root) => invoke(raw, "economics/calculate", { root }),
    loadScenarios: (root) => invoke(raw, "scenarios/load", { root }),

    loadReportSections: (root) => invoke(raw, "report/sections/load", { root }),
    saveReportSections: (root, sections, origin) =>
      invoke(raw, "report/sections/save", { root, sections, origin }),
    generateReport: (root) => invoke(raw, "report/generate", { root }),
    loadGeneratedReport: (root) => invoke(raw, "report/load-generated", { root }),

    listArtifacts: (root) => invoke(raw, "artifacts/list", { root }),
    readArtifact: (root, relativePath) => invoke(raw, "artifacts/read", { root, relativePath }),
    listRuns: (root) => invoke(raw, "runs/list", { root }),
    listProvenance: (root) => invoke(raw, "provenance/list", { root }),
    readHistory: (root, kind, runId) => invoke(raw, "history/read", { root, kind, runId }),

    captureMarketSnapshot: (root, note) => invoke(raw, "snapshots/capture", { root, note }),
    listMarketSnapshots: (root) => invoke(raw, "snapshots/list", { root }),
    snapshotDiff: (root, fromId, toId) => invoke(raw, "snapshots/diff", { root, fromId, toId }),
    listingPriceHistory: (root) => invoke(raw, "snapshots/history", { root }),

    loadAiConfig: () => invoke(raw, "ai/config/load", {}),
    saveAiConfig: (request) => invoke(raw, "ai/config/save", request),
    testAi: (providerId) => invoke(raw, "ai/test", { providerId }),
    draftEvidence: (root, url, pageText) => invoke(raw, "ai/draft-evidence", { root, url, pageText }),
    draftSections: (root) => invoke(raw, "ai/draft-sections", { root }),
    draftPlan: (root) => invoke(raw, "ai/draft-plan", { root }),
    draftCompetitors: (root, pastedListings) =>
      invoke(raw, "ai/draft-competitors", { root, pastedListings }),
    reviewEconomics: (root) => invoke(raw, "ai/review-economics", { root }),
    auditReport: (root) => invoke(raw, "ai/audit-report", { root }),
  };
}
