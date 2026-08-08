import { useState } from "react";

import { useProject } from "../context/ProjectContext";
import { ObjectiveScreen } from "../features/objective/ObjectiveScreen";

const sections = ["Objective", "Evidence", "Competitors", "Economics", "Report", "Artifacts"] as const;
type Section = (typeof sections)[number];

export function AppShell() {
  const { client, closeProject, project, setProject } = useProject();
  const [section, setSection] = useState<Section>("Objective");
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
