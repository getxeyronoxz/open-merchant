import { useMemo, useRef, useState } from "react";

import { Button, EmptyState, InsetPanel, PageHeader, Panel, StatusMessage } from "../../components/ui";
import type { EvidenceSource, Observation } from "../../types";

type EvidenceStatus = "idle" | "saving" | "saved" | "unsaved" | "removing" | "error";

function nextSourceId(evidence: EvidenceSource[]) {
  const highest = evidence.reduce((max, source) => {
    const match = /^S-(\d+)$/.exec(source.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `S-${String(highest + 1).padStart(3, "0")}`;
}

function emptySource(id: string): EvidenceSource {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    url: "",
    title: "",
    notes: "",
    observations: [],
    observedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function sourceHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function EvidenceScreen({
  evidence,
  onSave,
}: {
  evidence: EvidenceSource[];
  onSave: (evidence: EvidenceSource[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EvidenceSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const draftRevision = useRef(0);
  const draftHost = useMemo(() => sourceHost(draft?.url ?? ""), [draft?.url]);

  const startAdd = () => {
    setError(null);
    setStatus("idle");
    draftRevision.current = 0;
    setDraft(emptySource(nextSourceId(evidence)));
  };

  const updateDraft = (next: EvidenceSource) => {
    draftRevision.current += 1;
    setDraft(next);
  };

  const addObservation = () => {
    if (!draft) return;
    updateDraft({
      ...draft,
      observations: [
        ...draft.observations,
        { id: `O-${draft.observations.length + 1}`, label: "", value: "", unit: null, note: "" },
      ],
    });
  };

  const saveSource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const saved = { ...draft, updatedAt: new Date().toISOString() };
    const submittedRevision = draftRevision.current;
    const next = evidence.some((source) => source.id === saved.id)
      ? evidence.map((source) => source.id === saved.id ? saved : source)
      : [...evidence, saved];
    setStatus("saving");
    setError(null);
    try {
      await onSave(next);
      if (draftRevision.current === submittedRevision) {
        setDraft(null);
        setStatus("saved");
      } else {
        setStatus("unsaved");
      }
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The source could not be saved.");
    }
  };

  const removeSource = async (source: EvidenceSource) => {
    if (!window.confirm(`Remove ${source.title}?`)) return;
    setRemovingId(source.id);
    setStatus("removing");
    setError(null);
    try {
      await onSave(evidence.filter((item) => item.id !== source.id));
      setStatus("saved");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The source could not be removed.");
    } finally {
      setRemovingId(null);
    }
  };

  const statusText = status === "saving"
    ? "Saving source"
    : status === "saved"
      ? "Source saved"
      : status === "unsaved"
        ? "Source saved · newer edits not saved"
      : status === "removing"
        ? "Removing source"
        : status === "error"
          ? "Source action failed"
          : null;
  const statusTone = status === "saved" ? "success" : status === "error" ? "error" : status === "idle" ? "neutral" : "working";
  const mutationActive = status === "saving" || status === "removing";

  return (
    <Panel>
      <PageHeader
        action={<Button disabled={mutationActive} icon="plus" onClick={startAdd} type="button" variant="primary">Add source</Button>}
        description="Capture the page, context, and observed values behind each commercial claim."
        eyebrow="Evidence"
        status={<StatusMessage tone={statusTone}>{statusText}</StatusMessage>}
        title="Keep the source behind every claim"
      />

      {draft ? (
        <form className="mt-6" onSubmit={(event) => void saveSource(event)}>
          <InsetPanel>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{draft.id}</p>
                <h3 className="mt-1 text-base font-semibold text-stone-100">{draft.title || "New evidence source"}</h3>
              </div>
              {draftHost ? <span className="rounded-full border border-stone-800 bg-stone-900 px-2.5 py-1 text-xs text-stone-400">{draftHost}</span> : null}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-stone-200">
                Source URL
                <input className="min-h-10 px-3 py-2" type="url" value={draft.url} onChange={(event) => updateDraft({ ...draft, url: event.target.value })} required />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-stone-200">
                Source title
                <input className="min-h-10 px-3 py-2" value={draft.title} onChange={(event) => updateDraft({ ...draft, title: event.target.value })} required />
              </label>
            </div>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-stone-200">
              Notes
              <textarea className="min-h-24 resize-y px-3 py-2.5 leading-6" value={draft.notes} onChange={(event) => updateDraft({ ...draft, notes: event.target.value })} />
            </label>

            <div className="mt-5 rounded-[var(--radius-md)] border border-stone-800 bg-stone-950/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-100">Observed values</h3>
                  <p className="mt-1 text-xs text-stone-500">Keep numeric or qualitative observations attached to this source.</p>
                </div>
                <Button icon="plus" onClick={addObservation} size="sm" type="button" variant="ghost">Add observation</Button>
              </div>
              {draft.observations.length === 0 ? <p className="mt-4 text-sm text-stone-500">No observed values added.</p> : null}
              {draft.observations.map((observation, index) => (
                <ObservationFields
                  key={observation.id}
                  observation={observation}
                  onChange={(updated) => updateDraft({
                    ...draft,
                    observations: draft.observations.map((item, itemIndex) => itemIndex === index ? updated : item),
                  })}
                />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button disabled={status === "saving"} icon="save" type="submit" variant="primary">
                {status === "saving" ? "Saving source…" : "Save source"}
              </Button>
              <Button disabled={status === "saving"} onClick={() => setDraft(null)} type="button">Cancel</Button>
            </div>
            {error ? <p className="mt-4 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p> : null}
          </InsetPanel>
        </form>
      ) : null}

      {evidence.length > 0 ? (
        <ul className="mt-6 grid gap-3">
          {evidence.map((source) => (
            <li className="rounded-[var(--radius-lg)] border border-stone-800 bg-stone-950/35 p-4 transition-colors duration-[var(--motion-fast)] hover:border-stone-700 hover:bg-stone-950/50" key={source.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-stone-500">{source.id}</span>
                    <h3 className="font-semibold text-stone-100">{source.title}</h3>
                  </div>
                  <a className="mt-1.5 block truncate text-sm text-emerald-300 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-300/70" href={source.url} rel="noreferrer" target="_blank">{source.url}</a>
                  {source.notes ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-400">{source.notes}</p> : null}
                  <p className="mt-2 text-xs text-stone-500">Observed {new Date(source.observedAt).toLocaleDateString()} · {source.observations.length} observed values</p>
                </div>
                <div className="flex gap-1">
                  <Button disabled={mutationActive} onClick={() => { setError(null); setStatus("idle"); draftRevision.current = 0; setDraft(source); }} size="sm" type="button" variant="ghost">Edit</Button>
                  <Button disabled={mutationActive} onClick={() => void removeSource(source)} size="sm" type="button" variant="danger">{removingId === source.id ? "Removing…" : "Remove"}</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : !draft ? (
        <div className="mt-6">
          <EmptyState
            action={<Button disabled={mutationActive} icon="plus" onClick={startAdd} size="sm" type="button" variant="secondary">Add first source</Button>}
            description="Add the listing, search result, supplier page, or report behind your research."
            icon="evidence"
            title="No evidence recorded yet"
          />
        </div>
      ) : null}
      {error && !draft ? <p className="mt-4 rounded-[var(--radius-md)] border border-rose-900/70 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert">{error}</p> : null}
    </Panel>
  );
}

function ObservationFields({ observation, onChange }: { observation: Observation; onChange: (observation: Observation) => void }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <input aria-label="Observation label" className="min-h-9 px-2.5 py-1.5 text-sm" placeholder="Label" value={observation.label} onChange={(event) => onChange({ ...observation, label: event.target.value })} />
      <input aria-label="Observation value" className="min-h-9 px-2.5 py-1.5 text-sm" placeholder="Value" value={observation.value} onChange={(event) => onChange({ ...observation, value: event.target.value })} />
      <input aria-label="Observation unit" className="min-h-9 px-2.5 py-1.5 text-sm" placeholder="Unit" value={observation.unit ?? ""} onChange={(event) => onChange({ ...observation, unit: event.target.value || null })} />
    </div>
  );
}
