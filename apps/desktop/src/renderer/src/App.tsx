import { useCallback, useEffect, useState } from "react";
import type { Manifest, RecentProject, SerializedAppError } from "@open-merchant/shared";
import { AppError } from "@open-merchant/shared";

import { client } from "./client";

/**
 * Walking-skeleton Home screen (phase 0). Proves the full path
 * renderer → SDK → preload → main → core → disk → back. The real design
 * system and workspace screens arrive in phase 1c.
 */

function errorFrom(reason: unknown): SerializedAppError {
  if (reason instanceof AppError) return reason.toJSON();
  const message = reason instanceof Error ? reason.message : String(reason);
  return { code: "storage-error", message };
}

export function App() {
  const [appInfo, setAppInfo] = useState<{ appName: string; appVersion: string; platform: string } | null>(null);
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [project, setProject] = useState<{ root: string; manifest: Manifest } | null>(null);
  const [error, setError] = useState<SerializedAppError | null>(null);
  const [form, setForm] = useState({ parentDirectory: "", name: "", objective: "", currency: "INR" });
  const [isWorking, setIsWorking] = useState(false);

  const refreshRecents = useCallback(async () => {
    try {
      setRecents((await client.listRecents()).projects);
    } catch (reason) {
      setError(errorFrom(reason));
    }
  }, []);

  useEffect(() => {
    void client
      .appInfo()
      .then(setAppInfo)
      .catch((reason) => setError(errorFrom(reason)));
    void refreshRecents();
  }, [refreshRecents]);

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsWorking(true);
    setError(null);
    try {
      setProject((await client.createProject(form)).snapshot);
      await refreshRecents();
    } catch (reason) {
      setError(errorFrom(reason));
    } finally {
      setIsWorking(false);
    }
  };

  const openRecent = async (path: string) => {
    setIsWorking(true);
    setError(null);
    try {
      setProject((await client.openProject({ root: path })).snapshot);
    } catch (reason) {
      setError(errorFrom(reason));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <main className="skeleton-shell">
      <header className="skeleton-header">
        <h1>Open Merchant</h1>
        {appInfo ? (
          <span className="skeleton-meta">
            v{appInfo.appVersion} · {appInfo.platform}
          </span>
        ) : null}
      </header>

      {project ? (
        <section className="skeleton-card" aria-label="Open project">
          <p className="skeleton-eyebrow">Open project</p>
          <h2>{project.manifest.name}</h2>
          <p>{project.manifest.objective}</p>
          <p className="skeleton-meta">
            {project.manifest.currency} · schema v{project.manifest.schemaVersion} · {project.root}
          </p>
          <button
            className="om-button om-button--secondary"
            onClick={() => {
              setProject(null);
            }}
            type="button"
          >
            Close project
          </button>
        </section>
      ) : (
        <>
          <form className="skeleton-card" onSubmit={(event) => void createProject(event)}>
            <p className="skeleton-eyebrow">Create a project</p>
            <label>
              Parent directory
              <input
                onChange={(event) => setForm({ ...form, parentDirectory: event.target.value })}
                placeholder="C:\Users\you\research"
                required
                value={form.parentDirectory}
              />
            </label>
            <label>
              Project name
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Mechanical keyboards India"
                required
                value={form.name}
              />
            </label>
            <label>
              Research objective
              <textarea
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
                placeholder="What commercial decision are you making?"
                required
                value={form.objective}
              />
            </label>
            <label>
              Currency
              <input
                maxLength={3}
                onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
                required
                value={form.currency}
              />
            </label>
            <button className="om-button om-button--primary" disabled={isWorking} type="submit">
              {isWorking ? "Working…" : "Create workspace"}
            </button>
          </form>

          <section className="skeleton-card" aria-label="Recent projects">
            <p className="skeleton-eyebrow">Recent projects</p>
            {recents.length === 0 ? (
              <p className="skeleton-meta">Nothing yet — create your first project.</p>
            ) : (
              <ul className="skeleton-recents">
                {recents.map((recent) => (
                  <li key={recent.path}>
                    <button
                      className="om-button om-button--ghost"
                      disabled={isWorking}
                      onClick={() => void openRecent(recent.path)}
                      type="button"
                    >
                      {recent.name}
                    </button>
                    <span className="skeleton-meta">{recent.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error ? (
        <p className="skeleton-error" role="alert">
          <strong>{error.code}</strong> — {error.message}
        </p>
      ) : null}
    </main>
  );
}
