import { useEffect, useState, type ReactNode } from "react";

import { useProject } from "../context/ProjectContext";
import { BrandMark } from "./BrandMark";
import { ObjectiveScreen } from "../features/objective/ObjectiveScreen";
import { EvidenceScreen } from "../features/evidence/EvidenceScreen";
import { CompetitorsScreen } from "../features/competitors/CompetitorsScreen";
import { EconomicsScreen } from "../features/economics/EconomicsScreen";
import { ReportScreen } from "../features/report/ReportScreen";
import { ArtifactsScreen } from "../features/artifacts/ArtifactsScreen";
import type { Competitor, CompetitorStatistics, CostAssumptions, EconomicsScenario, EvidenceSource, ReportSections } from "../types";

const sections = [
  { name: "Objective", label: "Research objective", icon: "target" },
  { name: "Evidence", label: "Evidence library", icon: "bookmark" },
  { name: "Competitors", label: "Market landscape", icon: "grid" },
  { name: "Economics", label: "Unit economics", icon: "chart" },
  { name: "Report", label: "Opportunity report", icon: "document" },
  { name: "Artifacts", label: "Files & history", icon: "folder" },
] as const;
type Section = (typeof sections)[number]["name"];
type IconName = (typeof sections)[number]["icon"] | "arrow" | "check";

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

  const currentSection = sections.find((item) => item.name === section) ?? sections[0];

  return (
    <main className="workspace-shell">
      <header className="workspace-titlebar">
        <div className="brand-lockup" aria-label="Open Merchant">
            <BrandMark />
          <span>Open Merchant</span>
        </div>
        <div className="titlebar-project">
          <h1 className="titlebar-project-name">{project.manifest.name}</h1>
          <span className="titlebar-divider" aria-hidden="true" />
          <span className="local-status"><span className="status-dot" />Local workspace</span>
        </div>
      </header>

      <div className="workspace-frame">
        <aside className="workspace-sidebar">
          <div className="project-switcher">
            <div className="project-avatar" aria-hidden="true">{project.manifest.name.slice(0, 1).toUpperCase()}</div>
            <div className="project-switcher-copy">
              <strong>{project.manifest.name}</strong>
              <span>{project.manifest.currency} project</span>
            </div>
            <Icon name="arrow" />
          </div>

          <p className="nav-label">Workspace</p>
          <nav aria-label="Workspace sections" className="workspace-nav">
            {sections.map((item) => {
              const count = item.name === "Evidence" ? evidence.length : item.name === "Competitors" ? competitors.length : null;
              return (
                <button
                  aria-current={section === item.name ? "page" : undefined}
                  className="nav-item"
                  key={item.name}
                  onClick={() => setSection(item.name)}
                  type="button"
                >
                  <Icon name={item.icon} />
                  <span>{item.name}</span>
                  {count !== null && count > 0 ? <span className="nav-count">{count}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="local-note" aria-label="Private by design. Files stay on this device.">
              <span className="local-note-icon"><Icon name="check" /></span>
              <div><strong>Private by design</strong><span>Files stay on this device</span></div>
            </div>
            <button className="all-projects-button" onClick={closeProject} type="button"><Icon name="arrow" />All projects</button>
          </div>
        </aside>

        <section className="workspace-stage">
          <header className="stage-toolbar">
            <div className="breadcrumbs" aria-label="Current location">
              <span>{project.manifest.name}</span><Icon name="arrow" /><strong>{currentSection.label}</strong>
            </div>
            <div className="stage-meta">
              <span className="currency-badge">{project.manifest.currency}</span>
              <span className="project-path" title={project.root}>{project.root}</span>
            </div>
          </header>

          <div className="workspace-scroll">
            <div className="workspace-content" key={section}>
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
                <section className="loading-panel"><span className="loading-pulse" />Preparing {currentSection.label.toLowerCase()}…</section>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Icon({ name }: { name: IconName }): ReactNode {
  const paths: Record<IconName, ReactNode> = {
    target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    bookmark: <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17.5 6.5 21V4.5Z" />,
    grid: <><rect x="3" y="4" width="7" height="7" rx="2" /><rect x="14" y="4" width="7" height="7" rx="2" /><rect x="3" y="15" width="7" height="5" rx="2" /><rect x="14" y="15" width="7" height="5" rx="2" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h5" /></>,
    folder: <path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden="true" className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
