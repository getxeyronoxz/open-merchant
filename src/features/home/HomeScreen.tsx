import { useEffect, useState } from "react";

import { useProject } from "../../context/ProjectContext";
import { BrandMark } from "../../components/BrandMark";
import type { RecentProject } from "../../types";

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
    try { setRecents(await client.listRecentProjects()); }
    catch { setError("Recent projects could not be loaded."); }
  };

  useEffect(() => { void refreshRecents(); }, [client]);

  const startCreate = async () => {
    setError(null);
    const selected = await client.chooseDirectory("Choose where to create your project");
    if (selected) setParentDirectory(selected);
  };

  const createWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parentDirectory) return;
    setIsWorking(true);
    setError(null);
    try {
      setProject(await client.createProject({
        parentDirectory,
        name: name.trim(),
        objective: objective.trim(),
        currency: currency.trim(),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The workspace could not be created.");
    } finally { setIsWorking(false); }
  };

  const openWorkspace = async (root?: string) => {
    setError(null);
    const selected = root ?? (await client.chooseDirectory("Choose an Open Merchant project folder"));
    if (!selected) return;
    setIsWorking(true);
    try { setProject(await client.openProject(selected)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That folder is not an Open Merchant project."); }
    finally { setIsWorking(false); }
  };

  const removeRecent = async (root: string) => {
    await client.removeRecentProject(root);
    await refreshRecents();
  };

  return (
    <main className="home-shell">
      <div className="home-ambient home-ambient-one" aria-hidden="true" />
      <div className="home-ambient home-ambient-two" aria-hidden="true" />

      <header className="home-header">
        <h1 className="brand-lockup"><BrandMark /><span>Open Merchant</span></h1>
        <div className="home-header-meta"><span className="status-dot" />Local-first workspace</div>
      </header>

      <div className="home-grid">
        <section className="home-hero">
          <div className="eyebrow"><span>Commerce intelligence</span><span className="eyebrow-line" /></div>
          <h2>Make the call with<br /><em>evidence in hand.</em></h2>
          <p>Local commerce research workspace. Turn scattered product research into a clear, inspectable commercial decision—without accounts, cloud lock-in, or opaque calculations.</p>

          <div className="hero-actions">
            <button className="primary-action" onClick={() => void startCreate()} type="button"><span>Create project</span><span aria-hidden="true">↗</span></button>
            <button className="secondary-action" onClick={() => void openWorkspace()} type="button"><span className="folder-glyph" aria-hidden="true" />Open project folder</button>
          </div>

          <div className="workflow-preview" aria-label="Research workflow">
            <div className="workflow-line" aria-hidden="true" />
            {[
              ["01", "Capture", "Evidence & competitors"],
              ["02", "Model", "Deterministic economics"],
              ["03", "Decide", "Inspectable report"],
            ].map(([number, title, detail]) => <div className="workflow-step" key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></div>)}
          </div>
        </section>

        <aside className="launch-panel">
          <div className="launch-panel-top">
            <div><span className="panel-kicker">Workspace</span><h2>{parentDirectory ? "Create a project" : "Continue your research"}</h2></div>
            <span className="panel-monogram" aria-hidden="true">OM</span>
          </div>

          {parentDirectory ? (
            <form className="create-form" onSubmit={(event) => void createWorkspace(event)}>
              <div className="selected-directory"><span className="folder-glyph" />{parentDirectory}<button aria-label="Change project location" onClick={() => void startCreate()} type="button">Change</button></div>
              <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Mechanical keyboards India" required /></label>
              <label>Research objective<textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="What commercial decision are you making?" required /></label>
              <div className="currency-row"><label>Currency<input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required /></label><p>One currency per workspace</p></div>
              <button className="primary-action panel-action" disabled={isWorking} type="submit">{isWorking ? "Creating workspace…" : "Create workspace"}<span aria-hidden="true">→</span></button>
            </form>
          ) : (
            <div className="recent-projects">
              {recents.length === 0 ? (
                <button className="empty-recent" onClick={() => void startCreate()} type="button"><span className="empty-recent-mark">+</span><strong>Start your first decision workspace</strong><small>Choose a folder and define the research objective.</small></button>
              ) : (
                <ul>{recents.map((recent) => <li key={recent.path}><button onClick={() => void openWorkspace(recent.path)} type="button"><span className="recent-avatar">{recent.name.slice(0, 1).toUpperCase()}</span><span><strong>{recent.name}</strong><small>{recent.path}</small></span><span className="recent-arrow">→</span></button><button className="remove-recent" aria-label={`Remove ${recent.name} from recent projects`} onClick={() => void removeRecent(recent.path)} type="button">×</button></li>)}</ul>
              )}
              <button className="browse-projects" onClick={() => void openWorkspace()} type="button"><span className="folder-glyph" />Browse another project<span>→</span></button>
            </div>
          )}

          {error ? <p className="home-error" role="alert">{error}</p> : null}
          <div className="launch-panel-footer"><span><i className="status-dot" />Offline ready</span><span>Normal files</span><span>Private by default</span></div>
        </aside>
      </div>

      <footer className="home-footer"><span>AGPL-3.0-only · Xeyronox</span><span>Built for focused product decisions</span></footer>
    </main>
  );
}
