import { useEffect, useState } from "react";

import { useProject } from "../../context/ProjectContext";
import type { RecentProject } from "../../types";

const workspaceSections = [
  "Objective",
  "Evidence",
  "Competitors",
  "Economics",
  "Report",
  "Artifacts",
];

export function HomeScreen() {
  const { client, setProject } = useProject();
  const [parentDirectory, setParentDirectory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const refreshRecents = async () => {
    try {
      setRecents(await client.listRecentProjects());
    } catch {
      setError("Recent projects could not be loaded.");
    }
  };

  useEffect(() => {
    void refreshRecents();
  }, [client]);

  const startCreate = async () => {
    setError(null);
    const selected = await client.chooseDirectory("Choose where to create your project");
    if (selected) {
      setParentDirectory(selected);
    }
  };

  const createWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parentDirectory) return;
    setIsWorking(true);
    setError(null);
    try {
      const project = await client.createProject({
        parentDirectory,
        name: name.trim(),
        objective: objective.trim(),
        currency: currency.trim(),
      });
      setProject(project);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The workspace could not be created.");
    } finally {
      setIsWorking(false);
    }
  };

  const openWorkspace = async (root?: string) => {
    setError(null);
    const selected = root ?? (await client.chooseDirectory("Choose an Open Merchant project folder"));
    if (!selected) return;
    setIsWorking(true);
    try {
      setProject(await client.openProject(selected));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That folder is not an Open Merchant project.");
    } finally {
      setIsWorking(false);
    }
  };

  const removeRecent = async (root: string) => {
    await client.removeRecentProject(root);
    await refreshRecents();
  };

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-50 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium tracking-[0.18em] text-emerald-300">OPEN MERCHANT</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Open Merchant</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-300">
          Local commerce research workspace. Build a commercial decision you can inspect with evidence, competitor pricing, unit economics, and a clear opportunity report.
        </p>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Start a research project</h2>
              <button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950 hover:bg-emerald-300" onClick={() => void startCreate()} type="button">
                Create project
              </button>
            </div>

            {parentDirectory ? (
              <form className="mt-6 grid gap-4" onSubmit={(event) => void createWorkspace(event)}>
                <p className="rounded-lg bg-stone-800 px-3 py-2 text-sm text-stone-300">Creating in {parentDirectory}</p>
                <label className="grid gap-2 text-sm font-medium">
                  Project name
                  <input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-base" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Research objective
                  <textarea className="min-h-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-base" value={objective} onChange={(event) => setObjective(event.target.value)} required />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Currency
                  <input className="w-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-base uppercase" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required />
                </label>
                <button className="mt-2 rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-stone-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={isWorking} type="submit">
                  {isWorking ? "Creating…" : "Create workspace"}
                </button>
              </form>
            ) : (
              <p className="mt-6 text-stone-400">Choose a parent folder, then add the first research objective.</p>
            )}

            <div className="mt-6 border-t border-stone-800 pt-6">
              <button className="rounded-lg border border-stone-600 px-4 py-2 font-medium hover:border-stone-400" onClick={() => void openWorkspace()} type="button">
                Open project folder
              </button>
            </div>
            {error ? <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-200" role="alert">{error}</p> : null}
          </div>

          <aside className="rounded-2xl border border-stone-800 bg-stone-900/50 p-6">
            <h2 className="text-xl font-semibold">Recent projects</h2>
            {recents.length === 0 ? <p className="mt-4 text-stone-400">Projects you open will stay here on this device.</p> : null}
            <ul className="mt-4 grid gap-3">
              {recents.map((recent) => (
                <li className="rounded-lg border border-stone-800 bg-stone-950/50 p-3" key={recent.path}>
                  <button className="block text-left font-medium text-stone-100 hover:text-emerald-300" onClick={() => void openWorkspace(recent.path)} type="button">{recent.name}</button>
                  <p className="mt-1 break-all text-xs text-stone-500">{recent.path}</p>
                  <button className="mt-2 text-xs text-stone-400 underline hover:text-stone-100" onClick={() => void removeRecent(recent.path)} type="button">Remove from list</button>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </div>
    </main>
  );
}

export function WorkspaceShell() {
  const { closeProject, project } = useProject();
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
          {workspaceSections.map((section) => <div className="rounded-lg px-3 py-2 text-sm text-stone-300" key={section}>{section}</div>)}
        </nav>
        <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
          <p className="text-sm font-medium text-emerald-300">Research objective</p>
          <h2 className="mt-2 text-2xl font-semibold">{project.manifest.objective}</h2>
          <p className="mt-4 text-stone-400">This workspace is saved locally at {project.root}.</p>
        </section>
      </div>
    </main>
  );
}
