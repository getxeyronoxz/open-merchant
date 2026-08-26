import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState, LedgerRow } from "@open-merchant/ui";

import { client } from "../../client";
import { useProject } from "../../state/project";

/**
 * Home: create a project folder you own, reopen a recent one, or import a
 * legacy V0 project. Every failure is shown; nothing is swallowed.
 */

export function HomeScreen() {
  const { openProject } = useProject();
  const queryClient = useQueryClient();

  const [parentDirectory, setParentDirectory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [currency, setCurrency] = useState("INR");

  const recentsQuery = useQuery({
    queryKey: ["recents"],
    queryFn: () => client.listRecents(),
  });

  const invalidateRecents = () => {
    void queryClient.invalidateQueries({ queryKey: ["recents"] });
  };

  const chooseDirectory = useMutation({
    mutationFn: () => client.chooseDirectory("Choose where to create your project"),
    onSuccess: (result) => setParentDirectory(result.path),
  });

  const createProject = useMutation({
    mutationFn: () =>
      client.createProject({ parentDirectory: parentDirectory ?? "", name, objective, currency }),
    onSuccess: (result) => {
      invalidateRecents();
      openProject(result.snapshot);
    },
  });

  const openRecent = useMutation({
    mutationFn: (path: string) => client.openProject({ root: path }),
    onSuccess: (result) => openProject(result.snapshot),
  });

  return (
    <main className="home">
      <header className="home__top">
        <span className="home__brand">
          Open <em>Merchant</em>
        </span>
        <span className="om-badge om-badge--accent">
          <span className="om-dot" />
          Local-first
        </span>
      </header>

      <section className="home__hero">
        <p className="om-eyebrow">Commerce research workbench</p>
        <h1 className="home__thesis">
          Make the call,
          <br />
          <em>with evidence in hand.</em>
        </h1>
        <p className="home__lede">
          One inspectable project folder per decision — evidence, competitors, unit economics,
          and the report behind it. Your files, your machine, exact numbers.
        </p>

        <div className="om-ledger home__workflow" aria-label="How a decision comes together">
          <LedgerRow label="Capture" value="Evidence & competitors" tone="muted" />
          <LedgerRow label="Model" value="Deterministic economics" tone="muted" />
          <LedgerRow label="Decide" value="An inspectable report" tone="brass" />
        </div>
      </section>

      <aside className="home__panel om-card">
        {parentDirectory === null ? (
          <>
            <h2 className="home__panel-title">Continue your research</h2>
            {recentsQuery.isError ? <ErrorState error={recentsQuery.error} onRetry={() => recentsQuery.refetch()} /> : null}
            {recentsQuery.isPending ? (
              <p className="om-loading">
                <span className="om-spinner" /> Loading recent projects…
              </p>
            ) : null}
            {recentsQuery.data && recentsQuery.data.projects.length === 0 ? (
              <p className="home__empty-hint">No projects yet. Create your first decision workspace.</p>
            ) : null}
            <ul className="home__recents">
              {(recentsQuery.data?.projects ?? []).map((recent) => (
                <li key={recent.path}>
                  <button
                    className="home__recent"
                    disabled={openRecent.isPending}
                    onClick={() => openRecent.mutate(recent.path)}
                    type="button"
                  >
                    <span className="home__recent-avatar">{recent.name.slice(0, 1).toUpperCase()}</span>
                    <span className="home__recent-copy">
                      <strong>{recent.name}</strong>
                      <span className="om-data">{recent.path}</span>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>

            <button className="om-button om-button--primary" onClick={() => chooseDirectory.mutate()} type="button">
              Create a project
            </button>
            {chooseDirectory.isError ? <ErrorState error={chooseDirectory.error} /> : null}
          </>
        ) : (
          <form
            className="home__form"
            onSubmit={(event) => {
              event.preventDefault();
              createProject.mutate();
            }}
          >
            <h2 className="home__panel-title">New project</h2>
            <p className="om-data">{parentDirectory}</p>
            <label className="om-field">
              <span className="om-field__label">Project name</span>
              <input
                className="om-input"
                onChange={(event) => setName(event.target.value)}
                placeholder="Mechanical keyboards India"
                required
                value={name}
              />
            </label>
            <label className="om-field">
              <span className="om-field__label">Research objective</span>
              <textarea
                className="om-textarea"
                onChange={(event) => setObjective(event.target.value)}
                placeholder="What commercial decision are you making?"
                required
                value={objective}
              />
            </label>
            <label className="om-field">
              <span className="om-field__label">Currency</span>
              <input
                className="om-input"
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                pattern="[A-Za-z]{3}"
                required
                value={currency}
              />
              <span className="om-field__hint">One currency per workspace.</span>
            </label>
            <button
              className="om-button om-button--primary"
              disabled={createProject.isPending}
              type="submit"
            >
              {createProject.isPending ? "Creating…" : "Create workspace"}
            </button>
          </form>
        )}

        {createProject.isError ? (
          <ErrorState error={createProject.error} onRetry={() => createProject.reset()} />
        ) : null}
        {openRecent.isError ? (
          <ErrorState error={openRecent.error} onRetry={() => openRecent.reset()} />
        ) : null}
      </aside>

      <footer className="home__footer">
        <span>AGPL-3.0-only · Xeyronox</span>
        <span>Your files stay on this device</span>
      </footer>
    </main>
  );
}
