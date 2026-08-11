import { useEffect, useState } from "react";

import { useProject } from "../context/ProjectContext";
import { ObjectiveScreen } from "../features/objective/ObjectiveScreen";
import { EvidenceScreen } from "../features/evidence/EvidenceScreen";
import { CompetitorsScreen } from "../features/competitors/CompetitorsScreen";
import { EconomicsScreen } from "../features/economics/EconomicsScreen";
import { ReportScreen } from "../features/report/ReportScreen";
import { ArtifactsScreen } from "../features/artifacts/ArtifactsScreen";
import type { Competitor, CompetitorStatistics, CostAssumptions, EconomicsScenario, EvidenceSource, ReportSections } from "../types";
import { WorkspaceNavigation, type WorkspaceSection } from "./WorkspaceNavigation";
import { Button } from "./ui";

export function AppShell() {
  const { client, closeProject, project, setProject } = useProject();
  const [section, setSection] = useState<WorkspaceSection>("Objective");
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => window.innerWidth <= 1100);
  const [evidence, setEvidence] = useState<EvidenceSource[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [statistics, setStatistics] = useState<CompetitorStatistics>({ validPriceCount: 0, minimum: null, maximum: null, average: null, median: null });
  const [assumptions, setAssumptions] = useState<CostAssumptions | null>(null);
  const [scenarios, setScenarios] = useState<EconomicsScenario[]>([]);
  const [reportSections, setReportSections] = useState<ReportSections | null>(null);
  useEffect(() => {
    void client.loadEvidence(project?.root ?? "").then(setEvidence).catch(() => setEvidence([]));
  }, [client, project?.root]);
  useEffect(() => { void client.loadAssumptions(project?.root ?? "").then(setAssumptions).catch(() => setAssumptions(null)); }, [client, project?.root]);
  useEffect(() => { void client.loadScenarios(project?.root ?? "").then(setScenarios).catch(() => setScenarios([])); }, [client, project?.root]);
  useEffect(() => {
    void client.loadCompetitors(project?.root ?? "").then(setCompetitors).catch(() => setCompetitors([]));
  }, [client, project?.root]);
  useEffect(() => {
    void client.competitorStatistics(project?.root ?? "").then(setStatistics).catch(() => setStatistics({ validPriceCount: 0, minimum: null, maximum: null, average: null, median: null }));
  }, [client, project?.root]);
  useEffect(() => { void client.loadReportSections(project?.root ?? "").then(setReportSections).catch(() => setReportSections(null)); }, [client, project?.root]);
  if (!project) return null;

  return (
    <main className="min-h-screen bg-[var(--surface-app)] text-stone-50">
      <header className="sticky top-0 z-20 flex h-[81px] items-center justify-between border-b border-stone-800/90 bg-[#080b0cf2] px-5 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Open Merchant workspace</p>
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">{project.manifest.name}</h1>
        </div>
        <Button icon="arrow-left" onClick={closeProject} type="button">All projects</Button>
      </header>
      <div
        className="grid gap-4 p-4 transition-[grid-template-columns] duration-[var(--motion-fast)] sm:gap-5 sm:p-5"
        style={{ gridTemplateColumns: navigationCollapsed ? "76px minmax(0, 1fr)" : "216px minmax(0, 1fr)" }}
      >
        <WorkspaceNavigation
          activeSection={section}
          collapsed={navigationCollapsed}
          onCollapsedChange={setNavigationCollapsed}
          onSelect={setSection}
        />
        <div className="min-w-0">
          {section === "Objective" ? (
          <ObjectiveScreen
            snapshot={project}
            onSave={async (manifest) => {
              const saved = await client.saveManifest(project.root, manifest);
              setProject(saved);
            }}
          />
        ) : section === "Evidence" ? (
          <EvidenceScreen evidence={evidence} onSave={async (next) => { await client.saveEvidence(project.root, next); setEvidence(next); }} />
        ) : section === "Competitors" ? (
          <CompetitorsScreen currency={project.manifest.currency} competitors={competitors} evidence={evidence} statistics={statistics} onSave={async (next) => { await client.saveCompetitors(project.root, next); setCompetitors(next); setStatistics(await client.competitorStatistics(project.root)); }} />
        ) : section === "Economics" && assumptions ? (
          <EconomicsScreen assumptions={assumptions} scenarios={scenarios} onSave={async (next) => { await client.saveAssumptions(project.root, next); setAssumptions(next); }} onCalculate={async () => setScenarios(await client.calculateAndSaveScenarios(project.root))} />
        ) : section === "Report" && reportSections ? (
          <ReportScreen sections={reportSections} onSaveSections={async (next) => { await client.saveReportSections(project.root, next); setReportSections(next); }} onGenerate={() => client.generateReport(project.root)} />
        ) : section === "Artifacts" ? (
          <ArtifactsScreen client={client} projectRoot={project.root} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
