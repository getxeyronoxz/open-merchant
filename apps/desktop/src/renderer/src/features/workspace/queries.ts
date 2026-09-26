import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  csvImporterPresets,
  type Competitor,
  type CostAssumptions,
  type EvidenceSource,
  type GenerationOrigin,
  type ProviderId,
  type ReportSections,
} from "@open-merchant/shared";

import { client } from "../../client";

/** Workspace data hooks. Every mutation invalidates what it can affect. */

export function useRecents() {
  return useQuery({ queryKey: ["recents"], queryFn: () => client.listRecents() });
}

export function useEvidence(root: string) {
  return useQuery({
    queryKey: ["evidence", root],
    queryFn: () => client.loadEvidence(root),
  });
}

export function useCompetitors(root: string) {
  return useQuery({
    queryKey: ["competitors", root],
    queryFn: () => client.loadCompetitors(root),
  });
}

export function useCompetitorStatistics(root: string) {
  return useQuery({
    queryKey: ["statistics", root],
    queryFn: () => client.competitorStatistics(root),
  });
}

export function useAssumptions(root: string) {
  return useQuery({
    queryKey: ["assumptions", root],
    queryFn: () => client.loadAssumptions(root),
  });
}

export function useScenarios(root: string) {
  return useQuery({
    queryKey: ["scenarios", root],
    queryFn: () => client.loadScenarios(root),
  });
}

export function useReportSections(root: string) {
  return useQuery({
    queryKey: ["sections", root],
    queryFn: () => client.loadReportSections(root),
  });
}

export function useGeneratedReport(root: string) {
  return useQuery({
    queryKey: ["report", root],
    queryFn: () => client.loadGeneratedReport(root),
  });
}

export function useRuns(root: string) {
  return useQuery({
    queryKey: ["runs", root],
    queryFn: () => client.listRuns(root),
  });
}

export function useProvenance(root: string) {
  return useQuery({
    queryKey: ["provenance", root],
    queryFn: () => client.listProvenance(root),
  });
}

export function useReadHistory(
  root: string,
  kind: "scenarios" | "report",
  runId: string | null,
) {
  return useQuery({
    queryKey: ["history", root, kind, runId],
    queryFn: () => client.readHistory(root, kind, runId as string),
    enabled: runId !== null,
  });
}

export function useArtifacts(root: string) {
  return useQuery({
    queryKey: ["artifacts", root],
    queryFn: () => client.listArtifacts(root),
  });
}

// --- market snapshots (phase 2) ------------------------------------------------

export function useMarketSnapshots(root: string) {
  return useQuery({
    queryKey: ["snapshots", root],
    queryFn: () => client.listMarketSnapshots(root),
  });
}

export function useMarketPriceHistory(root: string) {
  return useQuery({
    queryKey: ["snapshot-history", root],
    queryFn: () => client.listingPriceHistory(root),
  });
}

export function useCaptureMarketSnapshot(root: string) {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (note: string) => client.captureMarketSnapshot(root, note),
    onSuccess: () =>
      invalidate(
        ["snapshots", root],
        ["snapshot-history", root],
        ["runs", root],
        ["margin-monitor", root],
      ),
  });
}

export function useSnapshotDiff(root: string, fromId: string | null, toId: string | null) {
  return useQuery({
    queryKey: ["snapshot-diff", root, fromId, toId],
    queryFn: () => client.snapshotDiff(root, fromId as string, toId as string),
    enabled: fromId !== null && toId !== null,
  });
}

export function useMarginMonitor(root: string) {
  return useQuery({
    queryKey: ["margin-monitor", root],
    queryFn: () => client.marginMonitor(root),
  });
}

export function useDecisionJournal(root: string) {
  return useQuery({
    queryKey: ["decision-journal", root],
    queryFn: () => client.decisionJournal(root),
  });
}

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: () => client.portfolioOverview(),
  });
}

export function useStandingReviews() {
  return useQuery({ queryKey: ["reviews", "standing"], queryFn: () => client.standingReviews() });
}

export function useDisposeReview() {
  return useMutation({
    mutationFn: ({
      root,
      reviewKey,
      action,
    }: {
      root: string;
      reviewKey: string;
      action: "snoozed" | "dismissed";
    }) => client.disposeReview(root, reviewKey, action),
  });
}

// --- currency change (phase 3) -------------------------------------------------

/**
 * A preview writes nothing: it is a pure read that returns the exact before and
 * after values, so it is a mutation here only because it takes arguments.
 */
export function useCurrencyPreview() {
  return useMutation({
    mutationFn: ({
      root,
      toCurrency,
      rate,
    }: {
      root: string;
      toCurrency: string;
      rate: string;
    }) => client.currencyPreview(root, toCurrency, rate),
  });
}

/**
 * Restating a project in another currency moves every artifact it owns, so
 * every screen that reads one is stale afterwards. There is no partial
 * refresh worth having: the whole project changed.
 */
export function useApplyCurrencyChange(root: string) {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ toCurrency, rate }: { toCurrency: string; rate: string }) =>
      client.applyCurrencyChange(root, toCurrency, rate),
    onSuccess: () =>
      invalidate(
        ["evidence", root],
        ["competitors", root],
        ["statistics", root],
        ["assumptions", root],
        ["scenarios", root],
        ["sections", root],
        ["report", root],
        ["artifacts", root],
        ["provenance", root],
        ["snapshots", root],
        ["snapshot-history", root],
        ["snapshot-diff", root],
        ["margin-monitor", root],
        ["decision-journal", root],
        ["runs", root],
        // Cross-project views: a restatement moves every project's margin, so
        // the portfolio ordering and the attention queue are stale too.
        ["reviews", "standing"],
        ["portfolio"],
      ),
  });
}

export function usePluginCatalog() {
  return useQuery({ queryKey: ["plugins"], queryFn: () => client.listPlugins() });
}

export function usePluginSource(pluginId: string | null) {
  return useQuery({
    queryKey: ["plugins", "source", pluginId],
    queryFn: () => client.readPluginSource(pluginId as string),
    enabled: pluginId !== null,
  });
}

export function useSetPluginEnabled() {
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      client.setPluginEnabled(pluginId, enabled),
    onSuccess: () => invalidate(["plugins"]),
  });
}

/** Enabled csv-importer plugins, offered as column-mapping presets. */
export function useCsvImporterPresets() {
  const catalog = usePluginCatalog();
  return csvImporterPresets(catalog.data?.plugins ?? []);
}

/**
 * Runs one enabled connector and hands back its drafts.
 *
 * This never writes to the project — the main process returns drafts and
 * journals the run, and the caller decides whether a human accepts anything.
 */
export function useConnectorFetch() {
  return useMutation({
    mutationFn: ({
      root,
      pluginId,
      query,
    }: {
      root: string;
      pluginId: string;
      query: string;
    }) => client.fetchFromConnector(root, pluginId, query),
  });
}

function useInvalidator() {
  const queryClient = useQueryClient();
  return (...keys: string[][]) => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

const ROOT_KEYS = (root: string) => ({
  evidence: ["evidence", root],
  competitors: ["competitors", root],
  statistics: ["statistics", root],
  assumptions: ["assumptions", root],
  scenarios: ["scenarios", root],
  sections: ["sections", root],
  report: ["report", root],
  marginMonitor: ["margin-monitor", root],
  decisionJournal: ["decision-journal", root],
});

export function useSaveEvidence(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (input: {
      sources: EvidenceSource[];
      origin?: GenerationOrigin;
    }) => client.saveEvidence(root, input.sources, input.origin),
    onSuccess: () => invalidate(keys.evidence, keys.decisionJournal),
  });
}

export function useSaveCompetitors(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (input: Competitor[] | { competitors: Competitor[]; origin?: GenerationOrigin }) =>
      Array.isArray(input)
        ? client.saveCompetitors(root, input)
        : client.saveCompetitors(root, input.competitors, input.origin),
    onSuccess: () => invalidate(keys.competitors, keys.statistics),
  });
}

export function useSaveAssumptions(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (assumptions: CostAssumptions) => client.saveAssumptions(root, assumptions),
    onSuccess: () => invalidate(keys.assumptions, keys.marginMonitor),
  });
}

export function useCalculateScenarios(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: () => client.calculateScenarios(root),
    onSuccess: () => invalidate(keys.scenarios, keys.marginMonitor),
  });
}

export function useSaveReportSections(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (input: {
      sections: ReportSections;
      origin?: GenerationOrigin;
    }) => client.saveReportSections(root, input.sections, input.origin),
    onSuccess: () => invalidate(keys.sections),
  });
}

export function useGenerateReport(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: () => client.generateReport(root),
    onSuccess: () => invalidate(keys.report, keys.scenarios, keys.decisionJournal),
  });
}

// --- AI copilot ---------------------------------------------------------------

export function useAiConfig() {
  return useQuery({ queryKey: ["ai-config"], queryFn: () => client.loadAiConfig() });
}

export function useSaveAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof client.saveAiConfig>[0]) =>
      client.saveAiConfig(request),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["ai-config"] }),
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: (providerId: ProviderId) => client.testAi(providerId),
  });
}

export function useDraftEvidence(root: string) {
  return useMutation({
    mutationFn: ({ url, pageText }: { url: string; pageText: string }) =>
      client.draftEvidence(root, url, pageText),
  });
}

export function useDraftSections(root: string) {
  return useMutation({
    mutationFn: () => client.draftSections(root),
  });
}

export function useDraftPlan(root: string) {
  return useMutation({
    mutationFn: () => client.draftPlan(root),
  });
}

export function useDraftCompetitors(root: string) {
  return useMutation({
    mutationFn: (pastedListings: string) => client.draftCompetitors(root, pastedListings),
  });
}

export function useReviewEconomics(root: string) {
  return useMutation({
    mutationFn: () => client.reviewEconomics(root),
  });
}

export function useAuditReport(root: string) {
  return useMutation({
    mutationFn: () => client.auditReport(root),
  });
}
