import { describe, expect, it } from "vitest";

import {
  computeWorkflowSteps,
  resolveResumeSection,
  type SectionName,
  type WorkflowProgressState,
} from "../src/renderer/src/features/workspace/workflowProgress";



describe("Onboarding Workflow State Machine", () => {
  it("initializes on an empty project with incomplete Objective and points to Objective", () => {
    const res = computeWorkflowSteps({
      hasObjective: false,
      evidenceCount: 0,
      competitorsCount: 0,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.totalSteps).toBe(6);
    expect(res.completedCount).toBe(0);
    expect(res.currentStep.id).toBe("Objective");
    expect(res.nextSection).toBe("Objective");
    expect(res.isReportGenerated).toBe(false);
  });

  it("initializes on a valid new project with Objective complete and points to Evidence", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 0,
      competitorsCount: 0,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(1);
    expect(res.currentStep.id).toBe("Evidence");
    expect(res.nextSection).toBe("Evidence");
    expect(res.isReportGenerated).toBe(false);
  });

  it("formats singular badge text correctly for 1 source and 1 competitor", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 1,
      competitorsCount: 1,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.steps[1]?.badgeText).toBe("1 source");
    expect(res.steps[2]?.badgeText).toBe("1 listing");
  });

  it("advances to Competitors once evidence is collected", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 2,
      competitorsCount: 0,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(2);
    expect(res.currentStep.id).toBe("Competitors");
    expect(res.steps[1]?.badgeText).toBe("2 sources");
  });

  it("advances to Economics once competitors are entered", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 2,
      competitorsCount: 3,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(3);
    expect(res.currentStep.id).toBe("Economics");
    expect(res.steps[2]?.badgeText).toBe("3 listings");
  });

  it("advances to Report once scenarios are calculated", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 2,
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(4);
    expect(res.currentStep.id).toBe("Report");
    expect(res.steps[3]?.badgeText).toBe("Calculated");
  });

  it("points to the earliest incomplete step if an earlier step becomes incomplete", () => {
    // E.g., user calculated scenarios and has competitors, but deleted all evidence sources
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 0,
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(3);
    expect(res.currentStep.id).toBe("Evidence");
    expect(res.nextSection).toBe("Evidence");
  });

  it("does not report milestone generated if report exists but earlier steps are invalidated", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 0, // deleted evidence
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: true,
      hasArtifacts: true,
    });

    expect(res.completedCount).toBe(5);
    expect(res.isReportGenerated).toBe(false);
    expect(res.currentStep.id).toBe("Evidence");
    expect(res.nextSection).toBe("Evidence");
  });

  it("requires artifacts to exist for the Artifacts step to be complete", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 1,
      competitorsCount: 1,
      scenariosCount: 1,
      hasReport: true,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(5);
    expect(res.isReportGenerated).toBe(false);
    expect(res.currentStep.id).toBe("Artifacts");
    expect(res.steps[5]?.badgeText).toBeUndefined();
  });

  it("does not display premature inspectable badge on Artifacts step before report is generated", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 1,
      competitorsCount: 1,
      scenariosCount: 1,
      hasReport: false,
      hasArtifacts: true,
    });

    expect(res.completedCount).toBe(4);
    expect(res.isReportGenerated).toBe(false);
    expect(res.steps[5]?.isComplete).toBe(false);
    expect(res.steps[5]?.badgeText).toBeUndefined();
  });

  it("handles negative or invalid count boundaries gracefully without crashing", () => {
    const res = computeWorkflowSteps({
      hasObjective: false,
      evidenceCount: -5,
      competitorsCount: -1,
      scenariosCount: -10,
      hasReport: false,
      hasArtifacts: false,
    });

    expect(res.completedCount).toBe(0);
    expect(res.currentStep.id).toBe("Objective");
    expect(res.steps[1]?.badgeText).toBeUndefined();
    expect(res.steps[2]?.badgeText).toBeUndefined();
    expect(res.steps[3]?.badgeText).toBeUndefined();
  });

  it("celebrates milestone and marks all steps complete when report is generated and all steps valid", () => {
    const res = computeWorkflowSteps({
      hasObjective: true,
      evidenceCount: 2,
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: true,
      hasArtifacts: true,
    });

    expect(res.completedCount).toBe(6);
    expect(res.currentStep.id).toBe("Artifacts");
    expect(res.isReportGenerated).toBe(true);
    expect(res.steps[4]?.badgeText).toBe("Generated");
    expect(res.steps[5]?.badgeText).toBe("Inspectable");
  });

  it("preserves the strict six-step sequence with exact labels and descriptions", () => {
    const state: WorkflowProgressState = {
      hasObjective: false,
      evidenceCount: 0,
      competitorsCount: 0,
      scenariosCount: 0,
      hasReport: false,
      hasArtifacts: false,
    };
    const res = computeWorkflowSteps(state);

    const expectedSequence: Array<{ id: SectionName; label: string }> = [
      { id: "Objective", label: "Research objective" },
      { id: "Evidence", label: "Evidence library" },
      { id: "Competitors", label: "Market landscape" },
      { id: "Economics", label: "Unit economics" },
      { id: "Report", label: "Opportunity report" },
      { id: "Artifacts", label: "Files & history" },
    ];

    expect(res.steps.map((s) => ({ id: s.id, label: s.label }))).toEqual(expectedSequence);
  });
});

describe("Reopen resume targeting", () => {
  const base: WorkflowProgressState = {
    hasObjective: false,
    evidenceCount: 0,
    competitorsCount: 0,
    scenariosCount: 0,
    hasReport: false,
    hasArtifacts: false,
  };

  it("lands a partially progressed project on its first incomplete step", () => {
    // Project created (objective done), reopened later with nothing else yet.
    expect(resolveResumeSection({ ...base, hasObjective: true }, "Objective")).toBe("Evidence");
  });

  it("resumes as far along as progress has reached, mid-walkthrough", () => {
    const res = resolveResumeSection(
      { ...base, hasObjective: true, evidenceCount: 2 },
      "Objective",
    );
    expect(res).toBe("Competitors");
  });

  it("does not move an untouched workspace off Objective", () => {
    expect(resolveResumeSection({ ...base }, "Objective")).toBeNull();
  });

  it("keeps the milestone view stable once the report exists and all steps are complete", () => {
    const complete: WorkflowProgressState = {
      hasObjective: true,
      evidenceCount: 2,
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: true,
      hasArtifacts: true,
    };
    expect(resolveResumeSection(complete, "Objective")).toBeNull();
  });

  it("never overrides a deliberate navigation away from Objective", () => {
    const partial: WorkflowProgressState = { ...base, hasObjective: true, evidenceCount: 1 };
    expect(resolveResumeSection(partial, "Competitors")).toBeNull();
  });

  it("still resumes when the report exists but a step fell back to incomplete", () => {
    const drifted: WorkflowProgressState = {
      hasObjective: true,
      evidenceCount: 0,
      competitorsCount: 3,
      scenariosCount: 3,
      hasReport: true,
      hasArtifacts: false,
    };
    expect(resolveResumeSection(drifted, "Objective")).toBe("Evidence");
  });
});

