import { useState, type ReactNode } from "react";

import { useProject } from "../../state/project";
import { useCompetitors, useEvidence } from "./queries";
import { ObjectiveScreen } from "./screens/ObjectiveScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { CompetitorsScreen } from "./screens/CompetitorsScreen";
import { EconomicsScreen } from "./screens/EconomicsScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { ArtifactsScreen } from "./screens/ArtifactsScreen";
import { AiSettingsScreen } from "./screens/AiSettingsScreen";

/**
 * The stable six-section workspace plus the AI assistant. The rail doubles
 * as a ledger of where the research stands; the stage keeps project context
 * overhead.
 */

const sections = [
  { name: "Objective", label: "Research objective" },
  { name: "Evidence", label: "Evidence library" },
  { name: "Competitors", label: "Market landscape" },
  { name: "Economics", label: "Unit economics" },
  { name: "Report", label: "Opportunity report" },
  { name: "Artifacts", label: "Files & history" },
] as const;

const assistantSection = { name: "AI", label: "AI settings" } as const;

type SectionName = (typeof sections)[number]["name"] | typeof assistantSection.name;

export function WorkspaceShell() {
  const { project, closeProject } = useProject();
  const [section, setSection] = useState<SectionName>("Objective");

  if (!project) return null;
  const root = project.root;

  return (
    <Shell root={root} section={section} setSection={setSection} closeProject={closeProject}>
      <Stage section={section} root={root} />
    </Shell>
  );
}

function Shell({
  root,
  section,
  setSection,
  closeProject,
  children,
}: {
  root: string;
  section: SectionName;
  setSection: (section: SectionName) => void;
  closeProject: () => void;
  children: ReactNode;
}) {
  const { project } = useProject();
  const evidence = useEvidence(root);
  const competitors = useCompetitors(root);
  if (!project) return null;

  const counts: Partial<Record<SectionName, number | undefined>> = {
    Evidence: evidence.data?.sources.length,
    Competitors: competitors.data?.competitors.length,
  };

  return (
    <main className="shell">
      <header className="shell__titlebar">
        <span className="home__brand home__brand--small">
          Open <em>Merchant</em>
        </span>
        <div className="shell__project">
          <strong>{project.manifest.name}</strong>
          <span className="om-badge om-badge--accent">
            <span className="om-dot" />
            Local workspace
          </span>
        </div>
      </header>

      <div className="shell__frame">
        <aside className="shell__rail">
          <div className="shell__identity">
            <span aria-hidden="true" className="shell__avatar">
              {project.manifest.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="shell__identity-copy">
              <strong>{project.manifest.name}</strong>
              <span>{project.manifest.currency} · local folder</span>
            </span>
          </div>

          <p className="shell__rail-label">Workspace</p>
          <nav aria-label="Workspace sections">
            <ul className="shell__nav">
              {sections.map((item) => {
                const count = counts[item.name];
                return (
                  <li key={item.name}>
                    <button
                      aria-current={section === item.name ? "page" : undefined}
                      className={`shell__nav-item${section === item.name ? " is-active" : ""}`}
                      onClick={() => setSection(item.name)}
                      type="button"
                    >
                      <span>{item.name}</span>
                      {count !== undefined && count > 0 ? (
                        <span className="om-badge">{count}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="shell__rail-label">Assistant</p>
          <ul className="shell__nav">
            <li>
              <button
                aria-current={section === assistantSection.name ? "page" : undefined}
                className={`shell__nav-item${section === assistantSection.name ? " is-active" : ""}`}
                onClick={() => setSection(assistantSection.name)}
                type="button"
              >
                <span>AI settings</span>
              </button>
            </li>
          </ul>

          <button
            className="om-button om-button--ghost shell__all-projects"
            onClick={closeProject}
            title="Back to all projects"
            type="button"
          >
            ← All projects
          </button>
        </aside>

        <section className="shell__stage">
          <header className="shell__toolbar">
            <span className="om-data" title={root}>
              {root}
            </span>
          </header>
          <div className="shell__scroll">
            {/* key restarts the entrance animation per section */}
            <div className="shell__content" key={section}>
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stage({ section, root }: { section: SectionName; root: string }) {
  switch (section) {
    case "Objective":
      return <ObjectiveScreen root={root} />;
    case "Evidence":
      return <EvidenceScreen root={root} />;
    case "Competitors":
      return <CompetitorsScreen root={root} />;
    case "Economics":
      return <EconomicsScreen root={root} />;
    case "Report":
      return <ReportScreen root={root} />;
    case "Artifacts":
      return <ArtifactsScreen root={root} />;
    case "AI":
      return <AiSettingsScreen />;
  }
}
