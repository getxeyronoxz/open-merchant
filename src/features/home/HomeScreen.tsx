import { useEffect, useState } from "react";

import { useProject } from "../../context/ProjectContext";
import type { RecentProject } from "../../types";
import { Button, EmptyState, InsetPanel, Panel, StatusMessage } from "../../components/ui";

type HomeAction = "choosing-create-folder" | "creating" | "opening" | null;

export function HomeScreen() {
  const { client, setProject } = useProject();
  const [parentDirectory, setParentDirectory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<HomeAction>(null);
  const [removingPath, setRemovingPath] = useState<string | null>(null);

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
    setActiveAction("choosing-create-folder");
    try {
      const selected = await client.chooseDirectory("Choose where to create your project");
      if (selected) setParentDirectory(selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The folder picker could not be opened.");
    } finally {
      setActiveAction(null);
    }
  };

  const createWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parentDirectory) return;
    setActiveAction("creating");
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
      setActiveAction(null);
    }
  };

  const openWorkspace = async (root?: string) => {
    setError(null);
    setActiveAction("opening");
    try {
      const selected = root ?? (await client.chooseDirectory("Choose an Open Merchant project folder"));
      if (!selected) return;
      setProject(await client.openProject(selected));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That folder is not an Open Merchant project.");
    } finally {
      setActiveAction(null);
    }
  };

  const removeRecent = async (root: string) => {
    setRemovingPath(root);
    setError(null);
    try {
      await client.removeRecentProject(root);
      await refreshRecents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The recent project could not be removed.");
    } finally {
      setRemovingPath(null);
    }
  };

  const actionStatus = activeAction === "creating"
    ? "Creating workspace"
    : activeAction === "opening"
      ? "Opening project"
      : activeAction === "choosing-create-folder"
        ? "Choosing folder"
        : null;

  return (
    <main className="min-h-screen bg-[var(--surface-app)] px-6 py-10 text-stone-50 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.22em] text-emerald-300">OPEN MERCHANT</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Open Merchant</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-300 sm:text-lg sm:leading-8">
          Local commerce research workspace. Build a commercial decision you can inspect with evidence, competitor pricing, unit economics, and a clear opportunity report.
        </p>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Start a research project</h2>
                <p className="mt-1 text-sm text-stone-500">Create a local workspace or open an existing project folder.</p>
              </div>
              <Button disabled={activeAction === "choosing-create-folder"} icon="plus" onClick={() => void startCreate()} type="button" variant="primary">
                {activeAction === "choosing-create-folder" ? "Choosing folder…" : "Create project"}
              </Button>
            </div>

            {parentDirectory ? (
              <form className="mt-6 grid gap-4" onSubmit={(event) => void createWorkspace(event)}>
                <InsetPanel className="flex items-center gap-2 py-3 text-sm text-stone-400">
                  <span className="font-medium text-stone-200">Creating in</span>
                  <span className="min-w-0 truncate" title={parentDirectory}>{parentDirectory}</span>
                </InsetPanel>
                <label className="grid gap-2 text-sm font-semibold text-stone-200">
                  Project name
                  <input className="min-h-11 px-3 py-2.5 text-base" value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-stone-200">
                  Research objective
                  <textarea className="min-h-28 resize-y px-3 py-2.5 text-base leading-6" value={objective} onChange={(event) => setObjective(event.target.value)} required />
                </label>
                <label className="grid max-w-32 gap-2 text-sm font-semibold text-stone-200">
                  Currency
                  <input className="min-h-11 px-3 py-2 text-base uppercase" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required />
                </label>
                <Button className="mt-1 w-full" disabled={activeAction === "creating"} icon="folder" type="submit" variant="primary">
                  {activeAction === "creating" ? "Creating workspace…" : "Create workspace"}
                </Button>
              </form>
            ) : (
              <div className="mt-6"><EmptyState description="Choose a parent folder, then add the first research objective." icon="folder" title="Your project stays in a normal local folder" /></div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-800 pt-6">
              <Button disabled={activeAction === "opening"} icon="folder" onClick={() => void openWorkspace()} type="button">
                {activeAction === "opening" ? "Opening project…" : "Open project folder"}
              </Button>
              <StatusMessage tone="working">{actionStatus}</StatusMessage>
            </div>
            {error ? <p className="mt-4 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p> : null}
          </Panel>

          <aside className="rounded-[var(--radius-xl)] border border-stone-800/90 bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-panel)] sm:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Recent projects</h2>
            <p className="mt-1 text-sm text-stone-500">Projects you open will stay here on this device.</p>
            <ul className="mt-4 grid gap-3">
              {recents.map((recent) => (
                <li className="rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950/40 p-3.5 transition-colors duration-[var(--motion-fast)] hover:border-stone-700 hover:bg-stone-950/60" key={recent.path}>
                  <button className="block w-full rounded text-left font-semibold text-stone-100 outline-none transition-colors hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/70" onClick={() => void openWorkspace(recent.path)} type="button">{recent.name}</button>
                  <p className="mt-1.5 break-all text-xs leading-5 text-stone-500">{recent.path}</p>
                  <Button className="mt-2 -ml-3" disabled={removingPath === recent.path} onClick={() => void removeRecent(recent.path)} size="sm" type="button" variant="ghost">{removingPath === recent.path ? "Removing…" : "Remove from list"}</Button>
                </li>
              ))}
            </ul>
            {recents.length === 0 ? <div className="mt-5"><EmptyState description="Create a project or open an existing workspace to keep it close at hand." icon="history" title="No recent projects yet" /></div> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
