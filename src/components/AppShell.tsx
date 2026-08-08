import { useEffect, useState } from "react";

import { useProject } from "../context/ProjectContext";
import { ObjectiveScreen } from "../features/objective/ObjectiveScreen";
import { EvidenceScreen } from "../features/evidence/EvidenceScreen";
import { CompetitorsScreen } from "../features/competitors/CompetitorsScreen";
import { EconomicsScreen } from "../features/economics/EconomicsScreen";
import { ReportScreen } from "../features/report/ReportScreen";
import { ArtifactsScreen } from "../features/artifacts/ArtifactsScreen";
import type { Competitor, CompetitorStatistics, CostAssumptions, EconomicsScenario, EvidenceSource, ReportSections } from "../types";

const sections = ["Objective", "Evidence", "Competitors", "Economics", "Report", "Artifacts"] as const;
type Section = (typeof sections)[number];

export function AppShell() {
  const { client, closeProject, project, setProject } = useProject();
  const [section, setSection] = useState<Section>("Objective");
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
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <header className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
        <div>
          <p className="text-sm text-emerald-300">Open Merchant workspace</p>
          <h1 className="text-xl font-semibold">{project.manifest.name}</h1>
        </div>
        <button className="rounded-lg border border-stone-700 px-3 py-2 text-sm hover:border-stone-400" onClick={closeProject} type="button">All projects</button>
      </header>
      <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Workspace sections" className="rounded-xl border border-stone-800 bg-stone-900 p-3">
          {sections.map((item) => (
            <button className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${section === item ? "bg-emerald-400 font-semibold text-stone-950" : "text-stone-300 hover:bg-stone-800"}`} key={item} onClick={() => setSection(item)} type="button">{item}</button>
          ))}
        </nav>
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
        ) : (
          <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
            <p className="text-sm font-medium text-emerald-300">{section}</p>
            <h2 className="mt-2 text-2xl font-semibold">Coming next in this workspace</h2>
            <p className="mt-3 text-stone-400">This project remains available locally at {project.root}.</p>
          </section>
        )}
      </div>
    </main>
  );
}
