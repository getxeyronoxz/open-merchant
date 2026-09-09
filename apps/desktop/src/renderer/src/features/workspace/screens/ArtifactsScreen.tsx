import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EmptyState, ErrorState } from "@open-merchant/ui";

import { client } from "../../../client";
import { diffLines, type DiffLineKind } from "../../../lib/diff";
import {
  useArtifacts,
  useDecisionJournal,
  useProvenance,
  useReadHistory,
  useRuns,
} from "../queries";
import { useQueryClient } from "@tanstack/react-query";
import { useProject } from "../../../state/project";
import type { SectionName } from "../useWorkflowProgress";

const REPORT_ARTIFACT = "reports/opportunity-report.md";
const SCENARIOS_ARTIFACT = "economics/scenarios.json";

const KIND_ARTIFACT = {
  report: REPORT_ARTIFACT,
  scenarios: SCENARIOS_ARTIFACT,
} as const;

type DiffKind = keyof typeof KIND_ARTIFACT;

function diffLineClass(kind: DiffLineKind): string {
  if (kind === "add") return "diff__line--add";
  if (kind === "del") return "diff__line--del";
  return "";
}

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

  // Diff state: which generated artifact, and which past generation is the
  // baseline to compare against the latest.
  const [diffKind, setDiffKind] = useState<DiffKind>("report");
  const [baselineRunId, setBaselineRunId] = useState<string | null>(null);

  // Provenance search state.
  const [provenanceQuery, setProvenanceQuery] = useState("");
  const [provenanceKind, setProvenanceKind] = useState<string>("all");

  const provenanceRows = provenance.data?.provenance ?? [];

  const generations = useMemo(
    () =>
      provenanceRows
        .filter((record) => record.artifactPath === KIND_ARTIFACT[diffKind])
        .slice()
        .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt)),
    [provenanceRows, diffKind],
  );

  const latestRun =
    generations.length > 0 ? generations[generations.length - 1] : null;
  const previousRun =
    baselineRunId !== null
      ? (generations.find((generation) => generation.runId === baselineRunId) ?? null)
      : generations.length >= 2
        ? generations[generations.length - 2]
        : null;

  const baseline = useReadHistory(root, diffKind, previousRun?.runId ?? null);
  const latest = useReadHistory(root, diffKind, latestRun?.runId ?? null);

  const diff = useMemo(() => {
    if (!baseline.data?.text || !latest.data?.text) return null;
    return diffLines(baseline.data.text, latest.data.text);
  }, [baseline.data?.text, latest.data?.text]);

  const provenanceKinds = useMemo(() => {
    const unique = new Set<string>();
    for (const record of provenanceRows) unique.add(record.artifactPath);
    return [...unique].sort();
  }, [provenanceRows]);

  const filteredProvenance = useMemo(() => {
    const query = provenanceQuery.trim().toLowerCase();
    return provenanceRows.filter((record) => {
      if (provenanceKind !== "all" && record.artifactPath !== provenanceKind) return false;
      if (!query) return true;
      const origin =
        record.origin.kind === "agent"
          ? `${record.origin.agentId} ${record.origin.providerId} ${record.origin.modelId}`
          : "user";
      return `${record.artifactPath} ${record.runId} ${record.sha256} ${origin}`
        .toLowerCase()
        .includes(query);
    });
  }, [provenanceRows, provenanceQuery, provenanceKind]);

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

      <div className="history">
        <div className="history__head">
          <div>
            <p className="om-eyebrow">What changed since last time</p>
            <h2 className="om-section-title">Compare generations side by side</h2>
          </div>
          <div className="history__tabs" role="tablist" aria-label="Artifact to compare">
            <button
              aria-selected={diffKind === "report"}
              className={`om-badge${diffKind === "report" ? " om-badge--accent" : ""}`}
              onClick={() => {
                setDiffKind("report");
                setBaselineRunId(null);
              }}
              role="tab"
              type="button"
            >
              Report
            </button>
            <button
              aria-selected={diffKind === "scenarios"}
              className={`om-badge${diffKind === "scenarios" ? " om-badge--accent" : ""}`}
              onClick={() => {
                setDiffKind("scenarios");
                setBaselineRunId(null);
              }}
              role="tab"
              type="button"
            >
              Scenarios
            </button>
          </div>
        </div>
        {generations.length === 0 ? (
          <EmptyState title={`No regenerated ${diffKind} yet`}>
            <span>
              Generate the {diffKind === "report" ? "report" : "scenarios"} at least once — the
              previous version will appear here so you can diff it against the latest.
            </span>
          </EmptyState>
        ) : (
          <>
            <div className="history__list" role="list" aria-label="Generations">
              {generations.map((generation, index) => {
                const isLatest = generation.runId === latestRun?.runId;
                const isBaseline = generation.runId === previousRun?.runId;
                return (
                  <button
                    aria-pressed={isBaseline}
                    className={`om-card history__item${isLatest ? " is-latest" : ""}${isBaseline ? " is-baseline" : ""}`}
                    disabled={isLatest}
                    key={generation.runId}
                    onClick={() => setBaselineRunId(isBaseline ? null : generation.runId)}
                    role="listitem"
                    type="button"
                  >
                    <span className="om-data">{new Date(generation.generatedAt).toLocaleString()}</span>
                    <span className="om-data">run {generation.runId.slice(0, 13)}…</span>
                    <span className={`om-badge${isLatest ? " om-badge--accent" : isBaseline ? " om-badge--warn" : ""}`}>
                      {isLatest ? "latest" : isBaseline ? "baseline" : `#${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {previousRun === null ? (
              <EmptyState title="Pick a baseline">
                <span>
                  Click an earlier generation above to compare it against the latest, or generate
                  once more to unlock the automatic previous-versus-latest diff.
                </span>
              </EmptyState>
            ) : latest.isPending || baseline.isPending ? (
              <p className="om-loading">
                <span className="om-spinner" /> Comparing generations…
              </p>
            ) : latest.isError || baseline.isError ? (
              <ErrorState error={latest.error ?? baseline.error} />
            ) : diff === null ? (
              <EmptyState title="Snapshot missing">
                <span>The selected generation has no stored snapshot to compare.</span>
              </EmptyState>
            ) : (
              <div className="diff" aria-label={`${diffKind} diff`}>
                <div className="diff__head">
                  <span className="om-eyebrow">Baseline</span>
                  <span className="om-badge om-badge--danger">removed</span>
                  <span className="om-badge om-badge--accent">added</span>
                  <span className="om-eyebrow">Latest</span>
                </div>
                <div className="diff__grid">
                  {diff.before.map((line, index) => (
                    <div className="diff__row" key={index}>
                      <pre className={`diff__cell ${diffLineClass(line.kind)}`}>
                        {line.text || "\u00a0"}
                      </pre>
                      <pre className={`diff__cell ${diffLineClass(diff.after[index]?.kind ?? "skip")}`}>
                        {diff.after[index]?.text || "\u00a0"}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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

      {!provenance.isPending && !provenance.isError && provenanceRows.length > 0 ? (
        <>
          <div className="provenance-filters">
            <p className="om-eyebrow">Provenance</p>
            <div className="provenance-filters__controls">
              <input
                aria-label="Filter provenance"
                className="om-input"
                onChange={(event) => setProvenanceQuery(event.target.value)}
                placeholder="Search run id, file, agent, model, hash…"
                type="search"
                value={provenanceQuery}
              />
              <select
                aria-label="Filter by artifact"
                className="om-input"
                onChange={(event) => setProvenanceKind(event.target.value)}
                value={provenanceKind}
              >
                <option value="all">All artifacts</option>
                {provenanceKinds.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filteredProvenance.length === 0 ? (
            <EmptyState title="No matching records">
              <span>Adjust the search or filter to see provenance records.</span>
            </EmptyState>
          ) : (
            <ul className="artifacts__provenance">
              {filteredProvenance.map((record, index) => (
                <li key={`${record.artifactPath}-${index}`} className="om-ledger__row">
                  <span className="om-data">{record.artifactPath}</span>
                  <span aria-hidden="true" className="om-ledger__leader" />
                  <span className="om-data">run {record.runId.slice(0, 13)}…</span>
                  <span className="om-data">{record.sha256.slice(0, 12)}…</span>
                  {record.origin.kind === "agent" ? (
                    <span
                      className="om-badge"
                      title={`${record.origin.providerId} · ${record.origin.modelId}`}
                    >
                      {record.origin.agentId}
                    </span>
                  ) : (
                    <span className="om-badge om-badge--warn">user</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <DataBackupsCard onRestored={() => undefined} />

      <DecisionJournalCard root={root} />

      <div className="om-card om-card--inset" style={{ marginTop: "var(--om-space-4)" }}>
        <p className="om-eyebrow">Local-First Verification</p>
        <p className="om-section-sub" style={{ marginTop: "var(--om-space-2)" }}>
          Every decision file in this workspace is stored in human-readable formats (.json, .jsonl, .md) on your local drive with cryptographic sha-256 provenance, and every generation keeps an immutable snapshot under .openmerchant/history/ so past versions can always be compared.
        </p>
      </div>
    </section>
  );
}

/**
 * Phase 2 — decision journal: dated report generations, any-two side-by-side
 * comparison, and stale-evidence flags ("would I still decide this today?").
 */
function DecisionJournalCard({ root }: { root: string }) {
  const journal = useDecisionJournal(root);
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);

  const entries = journal.data?.journal.entries ?? [];
  const aId = pickedA ?? (entries.length >= 2 ? (entries[entries.length - 2] as (typeof entries)[number]).runId : null);
  const bId = pickedB ?? (entries.length > 0 ? (entries[entries.length - 1] as (typeof entries)[number]).runId : null);

  const a = useReadHistory(root, "report", aId);
  const b = useReadHistory(root, "report", bId);
  const diff = useMemo(
    () => (a.data?.text && b.data?.text ? diffLines(a.data.text, b.data.text) : null),
    [a.data?.text, b.data?.text],
  );

  const stale = journal.data?.journal.staleEvidence ?? [];
  const staleAfterDays = journal.data?.journal.staleAfterDays ?? 30;

  return (
    <section className="om-card" aria-label="Decision journal">
      <p className="om-eyebrow">Decision journal</p>
      <p className="om-field__hint">
        Every generated report, dated. Compare any two generations and see which evidence has gone
        stale — would you still make this decision today?
      </p>

      {journal.isError ? (
        <ErrorState error={journal.error} onRetry={() => journal.refetch()} />
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title="No reports yet">
          <span>Generate your first report to start the journal.</span>
        </EmptyState>
      ) : (
        <>
          <div className="screen__grid">
            <div className="om-field">
              <label className="om-label" htmlFor="journal-from">
                Earlier report
              </label>
              <select
                className="om-input"
                id="journal-from"
                onChange={(event) => setPickedA(event.target.value || null)}
                value={aId ?? ""}
              >
                {entries.map((entry) => (
                  <option key={entry.runId} value={entry.runId}>
                    {new Date(entry.completedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="om-field">
              <label className="om-label" htmlFor="journal-to">
                Later report
              </label>
              <select
                className="om-input"
                id="journal-to"
                onChange={(event) => setPickedB(event.target.value || null)}
                value={bId ?? ""}
              >
                {entries.map((entry) => (
                  <option key={entry.runId} value={entry.runId}>
                    {new Date(entry.completedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {aId !== null && bId !== null && aId === bId ? (
            <p className="om-field__hint">Pick two different generations to compare.</p>
          ) : a.isError || b.isError ? (
            <ErrorState
              error={(a.error ?? b.error) as unknown}
              onRetry={() => {
                a.refetch();
                b.refetch();
              }}
            />
          ) : a.isPending || b.isPending ? (
            <p className="om-loading">
              <span className="om-spinner" /> Loading reports…
            </p>
          ) : diff ? (
            <div className="diff">
              {diff.before.map((line, index) => (
                <div className="diff__row" key={index}>
                  <div className={`diff__line ${diffLineClass(line.kind)}`}>
                    <span className="diff__sign">{line.kind === "del" ? "−" : ""}</span>
                    <span>{line.text}</span>
                  </div>
                  <div className={`diff__line ${diffLineClass(diff.after[index]?.kind ?? "same")}`}>
                    <span className="diff__sign">{diff.after[index]?.kind === "add" ? "+" : ""}</span>
                    <span>{diff.after[index]?.text ?? ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stale.length > 0 ? (
            <>
              <p className="om-eyebrow">
                Stale evidence — older than {staleAfterDays} days
              </p>
              <ul className="artifacts__provenance">
                {stale.map((entry) => (
                  <li key={entry.id} className="om-ledger__row">
                    <span className="om-data">{entry.id}</span>
                    <span aria-hidden="true" className="om-ledger__leader" />
                    <span>{entry.title}</span>
                    <span className="om-badge om-badge--warn">
                      {entry.ageDays} days old
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : journal.data ? (
            <p className="om-field__hint">
              All evidence is under {staleAfterDays} days old — nothing stale.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Phase 2 — data & backups: CSV exports, portable single-file archive
 * create/restore, and print-perfect PDF export of the generated report.
 */
function DataBackupsCard({ onRestored }: { onRestored: () => void }) {
  const queryClient = useQueryClient();
  const { project, openProject } = useProject();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const root = project?.root ?? "";

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(null);
    }
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (kind: "competitors" | "evidence" | "scenarios") =>
    run(`csv-${kind}`, async () => {
      const result = await client.exportCsv(root, kind);
      download(result.csv, result.filename, "text/csv");
      setMessage(`Exported ${result.filename}`);
    });

  const exportPdf = () =>
    run("pdf", async () => {
      const result = await client.exportReportPdf(root);
      setMessage(result.saved ? `Saved PDF to ${result.path ?? ""}` : "PDF export canceled.");
    });

  const exportArchive = () =>
    run("archive", async () => {
      const result = await client.createArchive(root);
      download(atob(result.archiveBase64), result.filename, "application/octet-stream");
      setMessage(`Archive saved as ${result.filename}`);
    });

  const restoreArchive = (file: File | undefined) => {
    if (!file || !project) return;
    void run("restore", async () => {
      const archiveBase64 = btoa(
        Array.from(new Uint8Array(await file.arrayBuffer()))
          .map((byte) => String.fromCharCode(byte))
          .join(""),
      );
      const choose = await client.chooseDirectory("Choose where to restore the project");
      if (choose.path === null) {
        setMessage("Restore canceled — no folder chosen.");
        return;
      }
      const result = await client.restoreArchive(choose.path, archiveBase64);
      void queryClient.invalidateQueries({ queryKey: ["recents"] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      onRestored();
      openProject(result.snapshot);
      setMessage(`Restored project at ${result.snapshot.root}`);
    });
  };

  return (
    <section className="om-card" aria-label="Data and backups">
      <p className="om-eyebrow">Data &amp; backups</p>
      <p className="om-field__hint">
        Everything is plain files in your project folder. Archive packs the whole workspace —
        evidence, competitors, snapshots, reports — into one portable file.
      </p>
      <div style={{ display: "flex", gap: "var(--om-space-3)", flexWrap: "wrap" }}>
        <button
          className="om-button om-button--secondary"
          disabled={busy !== null || root === ""}
          onClick={() => void exportCsv("competitors")}
          type="button"
        >
          Competitors CSV
        </button>
        <button
          className="om-button om-button--ghost"
          disabled={busy !== null || root === ""}
          onClick={() => void exportCsv("evidence")}
          type="button"
        >
          Evidence CSV
        </button>
        <button
          className="om-button om-button--ghost"
          disabled={busy !== null || root === ""}
          onClick={() => void exportCsv("scenarios")}
          type="button"
        >
          Scenarios CSV
        </button>
        <button
          className="om-button om-button--secondary"
          disabled={busy !== null || root === ""}
          onClick={() => void exportPdf()}
          type="button"
        >
          {busy === "pdf" ? "Rendering…" : "Export report PDF"}
        </button>
        <button
          className="om-button om-button--primary"
          disabled={busy !== null || root === ""}
          onClick={() => void exportArchive()}
          type="button"
        >
          {busy === "archive" ? "Packing…" : "Create archive (.omarchive)"}
        </button>
      </div>
      <div className="om-field" style={{ marginTop: "var(--om-space-3)" }}>
        <span className="om-field__label">Restore from archive</span>
        <input
          accept=".omarchive,application/json"
          className="om-input"
          disabled={busy !== null}
          onChange={(event) => restoreArchive(event.target.files?.[0])}
          type="file"
        />
        <span className="om-field__hint">
          Restores into a new project folder — never overwrites existing work.
        </span>
      </div>
      {message ? (
        <p className="om-badge om-badge--accent" role="status">
          {message}
        </p>
      ) : null}
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
