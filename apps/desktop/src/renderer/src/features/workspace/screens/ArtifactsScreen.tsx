import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EmptyState, ErrorState } from "@open-merchant/ui";

import { client } from "../../../client";
import {
  useArtifacts,
  useProvenance,
  useRuns,
} from "../queries";
import type { SectionName } from "../useWorkflowProgress";

/**
 * Files & history: the known artifacts of this project plus the run and
 * provenance journals that explain where generated files came from.
 */
export function ArtifactsScreen({
  root,
  onNavigate,
}: {
  root: string;
  onNavigate?: (section: SectionName) => void;
}) {
  void onNavigate;
  const artifacts = useArtifacts(root);
  const runs = useRuns(root);
  const provenance = useProvenance(root);
  const [selected, setSelected] = useState<string | null>(null);

  const readArtifact = useMutation({
    mutationFn: (relativePath: string) => client.readArtifact(root, relativePath),
    onSuccess: () => undefined,
  });

  if (artifacts.isPending) {
    return (
      <p className="om-loading">
        <span className="om-spinner" /> Listing artifacts…
      </p>
    );
  }
  if (artifacts.isError) {
    return <ErrorState error={artifacts.error} onRetry={() => artifacts.refetch()} />;
  }

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="om-eyebrow">Artifacts</p>
        <h1 className="om-section-title">Everything the app wrote, in one place</h1>
        <p className="om-section-sub">
          Only known project files are listed — and they are ordinary files on your disk.
        </p>
      </header>

      <div className="screen__columns">
        <div className="om-ledger artifacts__list">
          {artifacts.data.artifacts.map((artifact) => (
            <button
              className={`om-card artifacts__item${selected === artifact.path ? " is-selected" : ""}`}
              disabled={!artifact.exists}
              key={artifact.path}
              onClick={() => {
                setSelected(artifact.path);
                readArtifact.mutate(artifact.path);
              }}
              type="button"
            >
              <span className="om-data">{artifact.path}</span>
              <span className={`om-badge${artifact.exists ? " om-badge--accent" : ""}`}>
                {artifact.exists ? "present" : "not yet"}
              </span>
            </button>
          ))}
        </div>

        <aside className="screen__stats">
          {readArtifact.isError ? (
            <ErrorState error={readArtifact.error} />
          ) : selected !== null && readArtifact.data ? (
            <div className="om-paper report-preview" aria-label={`Contents of ${selected}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{readArtifact.data.text}</ReactMarkdown>
            </div>
          ) : (
            <EmptyState title="Select an artifact">
              <span>Choose a file on the left to inspect its contents.</span>
            </EmptyState>
          )}
        </aside>
      </div>

      <h2 className="om-section-title">History</h2>
      {runs.isPending || provenance.isPending ? (
        <p className="om-loading">
          <span className="om-spinner" /> Loading history…
        </p>
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => runs.refetch()} />
      ) : runs.data.runs.length === 0 ? (
        <EmptyState title="No operations recorded yet">
          <span>Creating the project and generating reports will appear here.</span>
        </EmptyState>
      ) : (
        <table className="om-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Operation</th>
              <th>Status</th>
              <th>Completed</th>
              <th>Outputs</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.runs.map((run) => (
              <tr key={run.runId}>
                <td className="om-data">{run.runId.slice(0, 13)}…</td>
                <td>{run.operation}</td>
                <td>
                  <span
                    className={`om-badge ${run.status === "succeeded" ? "om-badge--accent" : "om-badge--danger"}`}
                  >
                    {run.status}
                  </span>
                  {run.errorSummary && run.status === "failed" ? (
                    <div className="om-field__hint">{run.errorSummary}</div>
                  ) : null}
                </td>
                <td>{new Date(run.completedAt).toLocaleString()}</td>
                <td className="om-num">{run.outputArtifacts.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!provenance.isPending && !provenance.isError && provenance.data.provenance.length > 0 ? (
        <>
          <p className="om-eyebrow">Provenance</p>
          <ul className="artifacts__provenance">
            {provenance.data.provenance.map((record, index) => (
              <li key={`${record.artifactPath}-${index}`} className="om-ledger__row">
                <span className="om-data">{record.artifactPath}</span>
                <span aria-hidden="true" className="om-ledger__leader" />
                <span className="om-data">run {record.runId.slice(0, 13)}…</span>
                <span className="om-data">{record.sha256.slice(0, 12)}…</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="om-card om-card--inset" style={{ marginTop: "var(--om-space-4)" }}>
        <p className="om-eyebrow">Local-First Verification</p>
        <p className="om-section-sub" style={{ marginTop: "var(--om-space-2)" }}>
          Every decision file in this workspace is stored in human-readable formats (.json, .jsonl, .md) on your local drive with cryptographic sha-256 provenance.
        </p>
      </div>
    </section>
  );
}
