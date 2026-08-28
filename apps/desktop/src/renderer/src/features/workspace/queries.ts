import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Competitor,
  CostAssumptions,
  EvidenceSource,
  GenerationOrigin,
  ProviderId,
  ReportSections,
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

export function useArtifacts(root: string) {
  return useQuery({
    queryKey: ["artifacts", root],
    queryFn: () => client.listArtifacts(root),
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
});

export function useSaveEvidence(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (input: {
      sources: EvidenceSource[];
      origin?: GenerationOrigin;
    }) => client.saveEvidence(root, input.sources, input.origin),
    onSuccess: (_result, input) => {
      void input;
      invalidate(keys.evidence);
    },
  });
}

export function useSaveCompetitors(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (competitors: Competitor[]) => client.saveCompetitors(root, competitors),
    onSuccess: () => invalidate(keys.competitors, keys.statistics),
  });
}

export function useSaveAssumptions(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: (assumptions: CostAssumptions) => client.saveAssumptions(root, assumptions),
    onSuccess: () => invalidate(keys.assumptions),
  });
}

export function useCalculateScenarios(root: string) {
  const invalidate = useInvalidator();
  const keys = ROOT_KEYS(root);
  return useMutation({
    mutationFn: () => client.calculateScenarios(root),
    onSuccess: () => invalidate(keys.scenarios),
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
    onSuccess: () => invalidate(keys.report, keys.scenarios),
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
