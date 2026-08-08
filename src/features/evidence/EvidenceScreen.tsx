import { useMemo, useState } from "react";

import type { EvidenceSource, Observation } from "../../types";

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

export function EvidenceScreen({
  evidence,
  onSave,
}: {
  evidence: EvidenceSource[];
  onSave: (evidence: EvidenceSource[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EvidenceSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceHost = useMemo(() => {
    if (!draft?.url) return "";
    try { return new URL(draft.url).host; } catch { return ""; }
  }, [draft?.url]);

  const addObservation = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      observations: [...draft.observations, { id: `O-${draft.observations.length + 1}`, label: "", value: "", unit: null, note: "" }],
    });
  };

  const saveSource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const saved = { ...draft, updatedAt: new Date().toISOString() };
    const next = evidence.some((source) => source.id === saved.id)
      ? evidence.map((source) => source.id === saved.id ? saved : source)
      : [...evidence, saved];
    try {
      setError(null);
      await onSave(next);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The source could not be saved.");
    }
  };

  const removeSource = async (source: EvidenceSource) => {
    if (!window.confirm(`Remove ${source.title}?`)) return;
    await onSave(evidence.filter((item) => item.id !== source.id));
  };

  return (
    <section className="rounded-xl border border-stone-800 bg-stone-900 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-300">Evidence</p>
          <h2 className="mt-1 text-2xl font-semibold">Keep the source behind every claim</h2>
        </div>
        <button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950 hover:bg-emerald-300" onClick={() => { setError(null); setDraft(emptySource(nextSourceId(evidence))); }} type="button">Add source</button>
      </div>

      {draft ? (
        <form className="mt-6 grid gap-4 border-t border-stone-800 pt-6" onSubmit={(event) => void saveSource(event)}>
          <p className="text-sm text-stone-400">{draft.id}{sourceHost ? ` · ${sourceHost}` : ""}</p>
          <label className="grid gap-2 text-sm font-medium">Source URL<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} required /></label>
          <label className="grid gap-2 text-sm font-medium">Source title<input className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
          <label className="grid gap-2 text-sm font-medium">Notes<textarea className="min-h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="rounded-lg bg-stone-950/60 p-4">
            <div className="flex items-center justify-between"><h3 className="font-medium">Observed values</h3><button className="text-sm text-emerald-300 underline" onClick={addObservation} type="button">Add observation</button></div>
            {draft.observations.map((observation, index) => <ObservationFields key={observation.id} observation={observation} onChange={(updated) => setDraft({ ...draft, observations: draft.observations.map((item, itemIndex) => itemIndex === index ? updated : item) })} />)}
          </div>
          <div className="flex gap-3"><button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-stone-950" type="submit">Save source</button><button className="rounded-lg border border-stone-700 px-4 py-2" onClick={() => setDraft(null)} type="button">Cancel</button></div>
          {error ? <p className="text-sm text-rose-300" role="alert">{error}</p> : null}
        </form>
      ) : null}

      <ul className="mt-6 grid gap-3">
        {evidence.map((source) => <li className="rounded-lg border border-stone-800 bg-stone-950/50 p-4" key={source.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{source.title}</h3><a className="mt-1 block break-all text-sm text-emerald-300 hover:underline" href={source.url} rel="noreferrer" target="_blank">{source.url}</a><p className="mt-2 text-sm text-stone-400">{new Date(source.observedAt).toLocaleDateString()} · {source.observations.length} observed values</p></div><div className="flex gap-3"><button className="text-sm text-stone-300 underline" onClick={() => setDraft(source)} type="button">Edit</button><button className="text-sm text-rose-300 underline" onClick={() => void removeSource(source)} type="button">Remove</button></div></div></li>)}
      </ul>
      {evidence.length === 0 && !draft ? <p className="mt-6 text-stone-400">No sources recorded yet. Add the listing, search result, supplier page, or report behind your research.</p> : null}
    </section>
  );
}

function ObservationFields({ observation, onChange }: { observation: Observation; onChange: (observation: Observation) => void }) {
  return <div className="mt-3 grid gap-2 sm:grid-cols-3"><input aria-label="Observation label" className="rounded border border-stone-700 bg-stone-950 px-2 py-1" placeholder="Label" value={observation.label} onChange={(event) => onChange({ ...observation, label: event.target.value })} /><input aria-label="Observation value" className="rounded border border-stone-700 bg-stone-950 px-2 py-1" placeholder="Value" value={observation.value} onChange={(event) => onChange({ ...observation, value: event.target.value })} /><input aria-label="Observation unit" className="rounded border border-stone-700 bg-stone-950 px-2 py-1" placeholder="Unit" value={observation.unit ?? ""} onChange={(event) => onChange({ ...observation, unit: event.target.value || null })} /></div>;
}
