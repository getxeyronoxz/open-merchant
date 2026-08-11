import { useEffect, useState } from "react";

import { EmptyState, PageHeader, Panel, StatusMessage, Tabs } from "../../components/ui";
import type { ArtifactDescriptor, DesktopClient, RunRecord } from "../../types";

type ArtifactStatus = "loading" | "idle" | "reading" | "ready" | "error";

function artifactStatusText(status: ArtifactStatus) {
  if (status === "loading") return "Loading artifacts";
  if (status === "reading") return "Loading artifact";
  if (status === "ready") return "Artifact loaded";
  if (status === "error") return "Artifact unavailable";
  return null;
}

export function ArtifactsScreen({ client, projectRoot }: { client: DesktopClient; projectRoot: string }) {
  const [tab, setTab] = useState<"artifacts" | "history">("artifacts");
  const [artifacts, setArtifacts] = useState<ArtifactDescriptor[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [artifactStatus, setArtifactStatus] = useState<ArtifactStatus>("loading");
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtifactStatus("loading");
    setArtifactError(null);
    setHistoryError(null);

    void client
      .listArtifacts(projectRoot)
      .then((nextArtifacts) => {
        if (cancelled) return;
        setArtifacts(nextArtifacts);
        setArtifactStatus("idle");
      })
      .catch((reason) => {
        if (cancelled) return;
        setArtifactError(reason instanceof Error ? reason.message : "Artifacts could not be loaded.");
        setArtifactStatus("error");
      });

    void client
      .listRuns(projectRoot)
      .then((nextRuns) => {
        if (!cancelled) setRuns(nextRuns);
      })
      .catch((reason) => {
        if (!cancelled) setHistoryError(reason instanceof Error ? reason.message : "Run history could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectRoot]);

  const select = async (artifact: ArtifactDescriptor) => {
    if (!artifact.exists) return;

    setSelectedPath(artifact.relativePath);
    setArtifactError(null);
    setArtifactStatus("reading");
    try {
      setContent(await client.readArtifact(projectRoot, artifact.relativePath));
      setArtifactStatus("ready");
    } catch (reason) {
      setArtifactError(reason instanceof Error ? reason.message : "Artifact could not be read.");
      setArtifactStatus("error");
    }
  };

  return (
    <Panel>
      <PageHeader
        description="Review the normal local files and run records produced by this workspace."
        eyebrow="Local artifacts"
        status={tab === "artifacts" ? (
          <StatusMessage
            label="Artifact status"
            tone={artifactStatus === "error" ? "error" : artifactStatus === "ready" ? "success" : "working"}
          >
            {artifactStatusText(artifactStatus)}
          </StatusMessage>
        ) : null}
        title="Inspect the files your workspace owns"
      />

      <div className="mt-5">
        <Tabs
          active={tab}
          onChange={(value) => setTab(value as "artifacts" | "history")}
          tabs={[{ label: "Artifacts", value: "artifacts" }, { label: "History", value: "history" }]}
        />
      </div>

      {tab === "artifacts" ? (
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
          {artifactStatus !== "loading" && artifacts.length === 0 ? (
            <EmptyState
              description="Generated workspace files will appear here when they are available."
              icon="archive"
              title="No artifacts available"
            />
          ) : (
            <ul className="min-w-0 rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950/45 p-2">
              {artifacts.map((artifact) => {
                const isSelected = selectedPath === artifact.relativePath;
                return (
                  <li key={artifact.relativePath}>
                    <button
                      aria-current={isSelected ? "true" : undefined}
                      className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm outline-none transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-emerald-300/70 disabled:cursor-not-allowed disabled:text-stone-700 ${isSelected ? "bg-stone-800 text-stone-50" : "text-stone-300 hover:bg-stone-900 hover:text-stone-50"}`}
                      disabled={!artifact.exists}
                      onClick={() => void select(artifact)}
                      type="button"
                    >
                      <span className="min-w-0 truncate">{artifact.relativePath.split("/").at(-1)}</span>
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        {artifact.exists ? artifact.kind : "Not generated"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="min-h-72 min-w-0 rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950 p-4 sm:p-5">
            {content ? (
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-stone-300">{content}</pre>
            ) : artifactStatus === "reading" ? (
              <p className="text-sm text-stone-500">Loading the selected artifact…</p>
            ) : (
              <EmptyState
                description="Choose an available file to inspect its text without leaving Open Merchant."
                icon="document"
                title="Select an artifact"
              />
            )}
            {artifactError ? <p className="mt-3 text-sm text-rose-300" role="alert">{artifactError}</p> : null}
          </div>
        </div>
      ) : historyError ? (
        <p className="mt-5 text-sm text-rose-300" role="alert">{historyError}</p>
      ) : (
        <History runs={runs} />
      )}
    </Panel>
  );
}

function History({ runs }: { runs: RunRecord[] }) {
  if (runs.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          description="Meaningful operations such as report generation will be recorded here."
          icon="history"
          title="No run history yet"
        />
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {runs.map((run) => {
        const isInterruptedReport = run.operation === "reportGenerated" && run.status === "failed";

        return (
          <article
            className={`rounded-[var(--radius-lg)] border p-4 transition-colors duration-[var(--motion-fast)] ${isInterruptedReport ? "border-rose-900/70 bg-rose-950/20" : "border-stone-800 bg-stone-950/45 hover:border-stone-700"}`}
            key={run.runId}
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className={`font-medium ${isInterruptedReport ? "text-rose-200" : "text-stone-100"}`}>
                  {isInterruptedReport ? "Report interrupted" : run.operation === "reportGenerated" ? "Report generated" : run.operation}
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  {isInterruptedReport
                    ? `Started ${new Date(run.startedAt).toLocaleString()}`
                    : `${new Date(run.completedAt).toLocaleString()} · ${run.status}`}
                </p>
              </div>
              <span className="font-mono text-xs text-stone-600">{run.runId}</span>
            </div>

            {isInterruptedReport ? (
              <p className="mt-3 text-sm leading-6 text-rose-100/90">
                {run.errorSummary ?? "Report generation did not complete. Review the workspace artifacts, then generate the report again."}
              </p>
            ) : null}

            {run.outputArtifacts.length > 0 ? (
              <div className="mt-3">
                {isInterruptedReport ? <p className="text-xs font-medium uppercase tracking-wide text-rose-200/80">Artifacts saved before interruption</p> : null}
                <ul className="mt-1 text-sm text-stone-300">
                  {run.outputArtifacts.map((artifact) => (
                    <li className="font-mono text-xs" key={artifact.path}>{artifact.path.split("/").at(-1)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
