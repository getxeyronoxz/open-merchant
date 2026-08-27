import { useState } from "react";

import { useProject } from "../../state/project";
import {
  useArtifacts,
  useCompetitors,
  useEvidence,
  useGeneratedReport,
  useScenarios,
} from "./queries";

import {
  computeWorkflowSteps,
  resolveResumeSection,
  type SectionName,
  type WorkflowProgressState,
  type WorkflowStep,
} from "./workflowProgress";

export type { SectionName, WorkflowProgressState, WorkflowStep };
export { computeWorkflowSteps, resolveResumeSection };


export function useWorkflowProgress(root: string) {
  const { project } = useProject();
  const evidence = useEvidence(root);
  const competitors = useCompetitors(root);
  const scenarios = useScenarios(root);
  const report = useGeneratedReport(root);
  const artifacts = useArtifacts(root);

  const [guideVisible, setGuideVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem("om:guide:visible") !== "false";
    } catch {
      return true;
    }
  });

  const toggleGuide = () => {
    setGuideVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("om:guide:visible", String(next));
      } catch {
        // Ignore localStorage access errors in sandboxed environments
      }
      return next;
    });
  };

  const hasObjective = Boolean(
    project?.manifest.name?.trim() && project?.manifest.objective?.trim(),
  );
  const evidenceCount = evidence.data?.sources.length ?? 0;
  const competitorsCount = competitors.data?.competitors.length ?? 0;
  const scenariosCount = scenarios.data?.scenarios.length ?? 0;
  const hasReport = Boolean(report.data?.markdown?.trim());
  const hasArtifacts = Boolean(artifacts.data?.artifacts.some((a) => a.exists));

  const progress: WorkflowProgressState = {
    hasObjective,
    evidenceCount,
    competitorsCount,
    scenariosCount,
    hasReport,
    hasArtifacts,
  };

  const calculated = computeWorkflowSteps(progress);

  return {
    ...calculated,
    guideVisible,
    toggleGuide,
    progress,
  };
}
