export type SectionName =
  | "Objective"
  | "Evidence"
  | "Competitors"
  | "Economics"
  | "Report"
  | "Artifacts"
  | "AI";

export interface WorkflowStep {
  readonly id: SectionName;
  readonly label: string;
  readonly description: string;
  readonly isComplete: boolean;
  readonly badgeText?: string;
}

export interface WorkflowProgressState {
  readonly hasObjective: boolean;
  readonly evidenceCount: number;
  readonly competitorsCount: number;
  readonly scenariosCount: number;
  readonly hasReport: boolean;
  readonly hasArtifacts: boolean;
}

export function computeWorkflowSteps(state: WorkflowProgressState): {
  readonly steps: WorkflowStep[];
  readonly currentStep: WorkflowStep;
  readonly completedCount: number;
  readonly totalSteps: number;
  readonly isReportGenerated: boolean;
  readonly nextSection: SectionName;
} {
  const steps: WorkflowStep[] = [
    {
      id: "Objective",
      label: "Research objective",
      description: "Define the commercial decision question",
      isComplete: state.hasObjective,
    },
    {
      id: "Evidence",
      label: "Evidence library",
      description: "Collect 1+ source listing or supplier reference",
      isComplete: state.evidenceCount > 0,
      badgeText:
        state.evidenceCount > 0
          ? `${state.evidenceCount} ${state.evidenceCount === 1 ? "source" : "sources"}`
          : undefined,
    },
    {
      id: "Competitors",
      label: "Market landscape",
      description: "Record 1+ comparable listing for price statistics",
      isComplete: state.competitorsCount > 0,
      badgeText:
        state.competitorsCount > 0
          ? `${state.competitorsCount} ${state.competitorsCount === 1 ? "listing" : "listings"}`
          : undefined,
    },
    {
      id: "Economics",
      label: "Unit economics",
      description: "Model unit costs and calculate profit scenarios",
      isComplete: state.scenariosCount > 0,
      badgeText: state.scenariosCount > 0 ? "Calculated" : undefined,
    },
    {
      id: "Report",
      label: "Opportunity report",
      description: "Draft narrative sections and generate final report",
      isComplete: state.hasReport,
      badgeText: state.hasReport ? "Generated" : undefined,
    },
    {
      id: "Artifacts",
      label: "Files & history",
      description: "Inspect local project files and provenance journal",
      isComplete: state.hasReport && state.hasArtifacts,
      badgeText: state.hasReport && state.hasArtifacts ? "Inspectable" : undefined,
    },
  ];

  const fallbackStep: WorkflowStep = steps[0] ?? {
    id: "Objective",
    label: "Research objective",
    description: "Define the commercial decision question",
    isComplete: state.hasObjective,
  };
  const currentStep: WorkflowStep =
    steps.find((s) => !s.isComplete) ?? steps[steps.length - 1] ?? fallbackStep;
  const completedCount = steps.filter((s) => s.isComplete).length;
  const isReportGenerated = state.hasReport && completedCount === steps.length;
  const nextSection: SectionName = currentStep.id;

  return {
    steps,
    currentStep,
    completedCount,
    totalSteps: steps.length,
    isReportGenerated,
    nextSection,
  };
}

/**
 * One-time reopen targeting: when a mid-walkthrough project is reopened,
 * land the user on the first incomplete step instead of the default
 * Objective section. Never overrides a deliberate navigation away from
 * Objective, an untouched workspace, or the post-report milestone view.
 */
export function resolveResumeSection(
  progress: WorkflowProgressState,
  activeSection: SectionName,
): SectionName | null {
  if (activeSection !== "Objective") return null;
  const result = computeWorkflowSteps(progress);
  if (result.completedCount === 0 || result.isReportGenerated) return null;
  return result.nextSection;
}
